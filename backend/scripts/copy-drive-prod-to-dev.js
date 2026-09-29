const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const googleDriveService = require('../services/googleDrive.service');

async function copyProdToDev() {
    console.log('🚀 Iniciando copia de archivos de Google Drive: prod ➔ dev...');
    await googleDriveService.init();
    const drive = googleDriveService.getDrive();
    const rootId = await googleDriveService.getRootFolderId();

    // 1. Get prod and dev folders
    const rootChildren = await drive.files.list({
        q: `'${rootId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        spaces: 'drive'
    });

    const prodFolder = rootChildren.data.files.find(f => f.name.toLowerCase() === 'prod' && f.mimeType === 'application/vnd.google-apps.folder');
    const devFolder = rootChildren.data.files.find(f => f.name.toLowerCase() === 'dev' && f.mimeType === 'application/vnd.google-apps.folder');

    if (!prodFolder) {
        throw new Error('No se encontró la carpeta "prod" en AutoCuentas');
    }
    if (!devFolder) {
        throw new Error('No se encontró la carpeta "dev" en AutoCuentas');
    }

    console.log(`📁 Origen  (prod): ${prodFolder.id}`);
    console.log(`📁 Destino (dev):  ${devFolder.id}\n`);

    const idMap = {};
    const stats = {
        foldersCreated: 0,
        foldersReused: 0,
        filesCopied: 0,
        filesSkipped: 0,
        errors: 0
    };

    /**
     * Recursively copy from sourceFolderId to destFolderId
     */
    async function syncFolder(srcFolderId, destFolderId, currentPath = '') {
        // Fetch all items in source folder
        let srcItems = [];
        let pageToken = null;
        do {
            const res = await drive.files.list({
                q: `'${srcFolderId}' in parents and trashed = false`,
                fields: 'nextPageToken, files(id, name, mimeType, size)',
                spaces: 'drive',
                pageSize: 100,
                pageToken: pageToken
            });
            srcItems = srcItems.concat(res.data.files || []);
            pageToken = res.data.nextPageToken;
        } while (pageToken);

        // Fetch all items in destination folder
        let destItems = [];
        pageToken = null;
        do {
            const res = await drive.files.list({
                q: `'${destFolderId}' in parents and trashed = false`,
                fields: 'nextPageToken, files(id, name, mimeType, size)',
                spaces: 'drive',
                pageSize: 100,
                pageToken: pageToken
            });
            destItems = destItems.concat(res.data.files || []);
            pageToken = res.data.nextPageToken;
        } while (pageToken);

        const destItemsByName = new Map();
        for (const item of destItems) {
            destItemsByName.set(item.name, item);
        }

        for (const item of srcItems) {
            const itemPath = `${currentPath}/${item.name}`;

            if (item.mimeType === 'application/vnd.google-apps.folder') {
                // Check if folder exists in dest
                let destSubFolderId;
                const existing = destItemsByName.get(item.name);
                if (existing && existing.mimeType === 'application/vnd.google-apps.folder') {
                    destSubFolderId = existing.id;
                    stats.foldersReused++;
                    console.log(`📂 Carpeta existente: ${itemPath}`);
                } else {
                    const created = await drive.files.create({
                        resource: {
                            name: item.name,
                            mimeType: 'application/vnd.google-apps.folder',
                            parents: [destFolderId]
                        },
                        fields: 'id, name'
                    });
                    destSubFolderId = created.data.id;
                    stats.foldersCreated++;
                    console.log(`✨ Carpeta creada en dev: ${itemPath} (${destSubFolderId})`);
                }

                idMap[item.id] = destSubFolderId;
                // Recurse into subfolder
                await syncFolder(item.id, destSubFolderId, itemPath);
            } else {
                // File
                const existingFile = destItemsByName.get(item.name);
                if (existingFile && existingFile.mimeType !== 'application/vnd.google-apps.folder' && existingFile.size === item.size) {
                    // Already copied with same size
                    stats.filesSkipped++;
                    idMap[item.id] = existingFile.id;
                    console.log(`  ⏩ Archivo ya existe (omitido): ${itemPath}`);
                } else {
                    try {
                        const copied = await drive.files.copy({
                            fileId: item.id,
                            requestBody: {
                                name: item.name,
                                parents: [destFolderId]
                            },
                            fields: 'id, name, size'
                        });
                        stats.filesCopied++;
                        idMap[item.id] = copied.data.id;
                        console.log(`  📋 Copiado: ${itemPath} -> dev (nuevo ID: ${copied.data.id})`);
                    } catch (copyErr) {
                        stats.errors++;
                        console.error(`  ❌ Error copiando ${itemPath}:`, copyErr.message);
                    }
                }
            }
        }
    }

    await syncFolder(prodFolder.id, devFolder.id, '');

    // Save map to disk
    const mapFile = path.resolve(__dirname, '..', 'drive-prod-to-dev-map.json');
    fs.writeFileSync(mapFile, JSON.stringify(idMap, null, 2));

    console.log('\n=============================================');
    console.log('🎉 COPIA DE PROD A DEV FINALIZADA CON ÉXITO');
    console.log('=============================================');
    console.log(`📁 Carpetas creadas:  ${stats.foldersCreated}`);
    console.log(`📁 Carpetas reusadas: ${stats.foldersReused}`);
    console.log(`📄 Archivos copiados: ${stats.filesCopied}`);
    console.log(`⏩ Archivos omitidos (ya existían): ${stats.filesSkipped}`);
    console.log(`❌ Errores:           ${stats.errors}`);
    console.log(`🗺️ Mapa de IDs guardado en: ${mapFile}`);
}

copyProdToDev().catch(err => {
    console.error('❌ Error fatal en copia de Google Drive:', err);
    process.exit(1);
});

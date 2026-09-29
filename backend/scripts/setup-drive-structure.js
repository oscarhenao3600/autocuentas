require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const googleDriveService = require('../services/googleDrive.service');

async function setupStructure() {
    console.log('🔧 Configurando estructura dev/prod en Google Drive...');
    await googleDriveService.init();
    const drive = googleDriveService.getDrive();
    const rootId = await googleDriveService.getRootFolderId();

    console.log(`📁 Carpeta raíz AutoCuentas ID: ${rootId}`);

    // Helper to get or create a child folder
    async function getOrCreateChildFolder(name, parentFolderId) {
        const query = `name = '${name}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const res = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (res.data.files && res.data.files.length > 0) {
            console.log(`  ℹ️ Carpeta existente: ${name} (${res.data.files[0].id})`);
            return res.data.files[0].id;
        }

        const folder = await drive.files.create({
            resource: {
                name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentFolderId]
            },
            fields: 'id'
        });
        console.log(`  ✨ Carpeta creada: ${name} (${folder.data.id})`);
        return folder.data.id;
    }

    // 1. Create dev and prod
    const devFolderId = await getOrCreateChildFolder('dev', rootId);
    const prodFolderId = await getOrCreateChildFolder('prod', rootId);

    // 2. Find direct children of rootId that are not dev or prod
    const listRes = await drive.files.list({
        q: `'${rootId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)'
    });

    for (const file of listRes.data.files) {
        if (file.id === devFolderId || file.id === prodFolderId) continue;

        console.log(`  🚚 Moviendo a 'dev': ${file.name} (${file.id})`);
        await drive.files.update({
            fileId: file.id,
            addParents: devFolderId,
            removeParents: rootId,
            fields: 'id, parents'
        });
    }

    console.log('\n✅ Estructura dev y prod configurada correctamente en Google Drive:');
    console.log(`   📂 AutoCuentas/`);
    console.log(`      ├── 📁 dev/  (ID: ${devFolderId})`);
    console.log(`      └── 📁 prod/ (ID: ${prodFolderId})`);
}

setupStructure().catch(err => {
    console.error('❌ Error configurando estructura:', err);
    process.exit(1);
});

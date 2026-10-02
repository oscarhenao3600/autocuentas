const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const googleDriveService = require('./googleDrive.service');

const LOCAL_TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates');

class TemplateService {
    constructor() {
        this.templatesFolderId = null;
        // In-memory cache for buffers with short TTL (e.g. 60 seconds) to avoid repeated Google Drive downloads
        // key: templateName -> { buffer, modifiedTime, cachedAt }
        this.bufferCache = new Map();
        this.cacheTTLMs = 60 * 1000; // 1 minute
    }

    /**
     * Resolves canonical name for known formats
     */
    getCanonicalTemplateName(originalName) {
        const clean = originalName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
        const ext = path.extname(originalName).toLowerCase() || '.docx';

        if (clean.includes('supervisor') || clean.includes('certificado')) {
            return `FORMATO CERTIFICADO DEL SUPERVISOR${ext}`;
        }
        if (clean.includes('informe') || clean.includes('actividad')) {
            return `FORMATO INFORME DE ACTIVIDADES${ext}`;
        }
        if (clean.includes('estampilla')) {
            return `FORMATO DESCUENTO DE ESTAMPILLAS${ext}`;
        }
        if (clean.includes('retencion') || clean.includes('fuente')) {
            return `FORMATO RETENCION EN LA FUENTE${ext}`;
        }
        if (clean.includes('anexo') && clean.includes('descripcion')) {
            return `FORMATO ANEXO DESCRIPCION${ext}`;
        }
        return originalName;
    }

    /**
     * Gets or creates the 'Plantillas' folder in Google Drive.
     * Looks first directly under AutoCuentas (so templates can be shared),
     * or inside the env folder (dev/prod). If not found, creates it under AutoCuentas root.
     */
    async getTemplatesFolderId() {
        if (this.templatesFolderId) return this.templatesFolderId;

        const drive = googleDriveService.getDrive();
        const rootId = await googleDriveService.getRootFolderId();

        // 1. Check directly under AutoCuentas root
        const rootQuery = `name = 'Plantillas' and '${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const rootRes = await drive.files.list({
            q: rootQuery,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (rootRes.data.files && rootRes.data.files.length > 0) {
            this.templatesFolderId = rootRes.data.files[0].id;
            return this.templatesFolderId;
        }

        // 2. Check inside the current environment folder (e.g. dev or prod)
        try {
            const envFolderId = await googleDriveService.ensureFolderPath([]);
            const envQuery = `name = 'Plantillas' and '${envFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const envRes = await drive.files.list({
                q: envQuery,
                fields: 'files(id, name)',
                spaces: 'drive'
            });

            if (envRes.data.files && envRes.data.files.length > 0) {
                this.templatesFolderId = envRes.data.files[0].id;
                return this.templatesFolderId;
            }
        } catch (_) {}

        // 3. Create under AutoCuentas root so it's easily visible and accessible to the user
        const folder = await drive.files.create({
            resource: {
                name: 'Plantillas',
                mimeType: 'application/vnd.google-apps.folder',
                parents: [rootId]
            },
            fields: 'id'
        });

        this.templatesFolderId = folder.data.id;
        console.log(`📁 Carpeta de Plantillas creada en Google Drive (ID: ${this.templatesFolderId})`);
        return this.templatesFolderId;
    }

    /**
     * Lists all templates from Google Drive 'Plantillas' folder.
     */
    async listDriveTemplates() {
        try {
            const drive = googleDriveService.getDrive();
            const folderId = await this.getTemplatesFolderId();

            const query = `'${folderId}' in parents and trashed = false`;
            const res = await drive.files.list({
                q: query,
                fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
                spaces: 'drive',
                orderBy: 'name'
            });

            return (res.data.files || []).map(f => ({
                id: f.id,
                name: f.name,
                size: f.size ? parseInt(f.size, 10) : 0,
                modifiedAt: f.modifiedTime,
                webViewLink: f.webViewLink,
                source: 'drive'
            }));
        } catch (err) {
            console.warn('⚠️ No se pudieron listar plantillas desde Google Drive:', err.message);
            return [];
        }
    }

    /**
     * Lists all local templates from disk.
     */
    listLocalTemplates() {
        if (!fs.existsSync(LOCAL_TEMPLATES_DIR)) {
            fs.mkdirSync(LOCAL_TEMPLATES_DIR, { recursive: true });
            return [];
        }

        const files = fs.readdirSync(LOCAL_TEMPLATES_DIR);
        return files
            .filter(f => !f.startsWith('.') && !f.endsWith('.bak'))
            .map(filename => {
                const filePath = path.join(LOCAL_TEMPLATES_DIR, filename);
                const stats = fs.statSync(filePath);
                return {
                    name: filename,
                    size: stats.size,
                    modifiedAt: stats.mtime,
                    source: 'local'
                };
            });
    }

    /**
     * Lists combined templates (Drive + Local merged)
     */
    async listTemplates() {
        const driveTemplates = await this.listDriveTemplates();
        const localTemplates = this.listLocalTemplates();

        const map = new Map();

        // Put local first
        for (const loc of localTemplates) {
            map.set(loc.name.toLowerCase(), {
                ...loc,
                inLocal: true,
                inDrive: false
            });
        }

        // Merge Drive templates (Drive takes precedence for metadata)
        for (const drv of driveTemplates) {
            const key = drv.name.toLowerCase();
            const existing = map.get(key) || {};
            map.set(key, {
                ...existing,
                ...drv,
                driveId: drv.id,
                inDrive: true,
                inLocal: Boolean(existing.inLocal)
            });
        }

        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Gets a template Buffer by name.
     * 1. Checks Google Drive folder 'Plantillas'
     * 2. If present, downloads Buffer, updates local disk cache, and returns it.
     * 3. If Drive fails or file not found in Drive, falls back to local disk.
     */
    async getTemplateBuffer(templateName) {
        const cleanName = path.basename(templateName);

        // Check in-memory cache first
        const cached = this.bufferCache.get(cleanName);
        const now = Date.now();
        if (cached && (now - cached.cachedAt < this.cacheTTLMs)) {
            return cached.buffer;
        }

        let driveBuffer = null;

        try {
            const drive = googleDriveService.getDrive();
            const folderId = await this.getTemplatesFolderId();

            // Query file by name in Drive folder
            const safeName = cleanName.replace(/'/g, "\\'");
            const query = `name = '${safeName}' and '${folderId}' in parents and trashed = false`;
            const res = await drive.files.list({
                q: query,
                fields: 'files(id, name, modifiedTime)',
                spaces: 'drive'
            });

            if (res.data.files && res.data.files.length > 0) {
                const driveFile = res.data.files[0];
                driveBuffer = await googleDriveService.downloadBuffer(driveFile.id);

                if (driveBuffer) {
                    console.log(`☁️ Plantilla "${cleanName}" obtenida directamente de Google Drive`);

                    // Update memory cache
                    this.bufferCache.set(cleanName, {
                        buffer: driveBuffer,
                        modifiedTime: driveFile.modifiedTime,
                        cachedAt: now
                    });

                    // Sync to local disk for offline resilience
                    try {
                        if (!fs.existsSync(LOCAL_TEMPLATES_DIR)) {
                            fs.mkdirSync(LOCAL_TEMPLATES_DIR, { recursive: true });
                        }
                        const localPath = path.join(LOCAL_TEMPLATES_DIR, cleanName);
                        fs.writeFileSync(localPath, driveBuffer);
                    } catch (_) {}

                    return driveBuffer;
                }
            }
        } catch (err) {
            console.warn(`⚠️ Aviso al buscar plantilla "${cleanName}" en Google Drive:`, err.message);
        }

        // Fallback to local disk
        const localPath = path.join(LOCAL_TEMPLATES_DIR, cleanName);
        if (fs.existsSync(localPath)) {
            console.log(`💾 Plantilla "${cleanName}" leída desde disco local`);
            const localBuffer = fs.readFileSync(localPath);
            this.bufferCache.set(cleanName, {
                buffer: localBuffer,
                cachedAt: now
            });
            return localBuffer;
        }

        throw new Error(`La plantilla "${cleanName}" no se encontró en Google Drive ni en el almacenamiento local.`);
    }

    /**
     * Uploads or updates a template both in Google Drive and local disk.
     */
    async saveTemplate(buffer, originalFilename) {
        const canonicalName = this.getCanonicalTemplateName(originalFilename);
        const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        // 1. Save to local disk
        if (!fs.existsSync(LOCAL_TEMPLATES_DIR)) {
            fs.mkdirSync(LOCAL_TEMPLATES_DIR, { recursive: true });
        }
        const localPath = path.join(LOCAL_TEMPLATES_DIR, canonicalName);
        fs.writeFileSync(localPath, buffer);

        if (canonicalName !== originalFilename) {
            fs.writeFileSync(path.join(LOCAL_TEMPLATES_DIR, originalFilename), buffer);
        }

        // Invalidate memory cache
        this.bufferCache.delete(canonicalName);
        this.bufferCache.delete(originalFilename);

        let driveResult = null;

        // 2. Upload / update in Google Drive
        try {
            const drive = googleDriveService.getDrive();
            const folderId = await this.getTemplatesFolderId();

            // Check if file already exists in folder
            const safeName = canonicalName.replace(/'/g, "\\'");
            const query = `name = '${safeName}' and '${folderId}' in parents and trashed = false`;
            const res = await drive.files.list({
                q: query,
                fields: 'files(id, name)',
                spaces: 'drive'
            });

            if (res.data.files && res.data.files.length > 0) {
                // Update existing file
                const existingId = res.data.files[0].id;
                const media = {
                    mimeType,
                    body: Readable.from(buffer)
                };
                const updateRes = await drive.files.update({
                    fileId: existingId,
                    media: media,
                    fields: 'id, name, mimeType, size, modifiedTime, webViewLink'
                });
                driveResult = updateRes.data;
                console.log(`☁️ Plantilla "${canonicalName}" actualizada en Google Drive (ID: ${existingId})`);
            } else {
                // Create new file in Plantillas folder
                const fileMetadata = {
                    name: canonicalName,
                    parents: [folderId]
                };
                const media = {
                    mimeType,
                    body: Readable.from(buffer)
                };
                const createRes = await drive.files.create({
                    resource: fileMetadata,
                    media: media,
                    fields: 'id, name, mimeType, size, modifiedTime, webViewLink'
                });
                driveResult = createRes.data;
                console.log(`☁️ Plantilla "${canonicalName}" creada en Google Drive (ID: ${driveResult.id})`);
            }
        } catch (driveErr) {
            console.warn(`⚠️ No se pudo respaldar la plantilla en Google Drive (se guardó en local):`, driveErr.message);
        }

        return {
            name: canonicalName,
            originalName: originalFilename,
            size: buffer.length,
            driveId: driveResult?.id || null,
            webViewLink: driveResult?.webViewLink || null
        };
    }

    /**
     * Deletes a template from local disk and Google Drive.
     */
    async deleteTemplate(filename) {
        const cleanName = path.basename(filename);
        this.bufferCache.delete(cleanName);

        // Delete from local disk
        const localPath = path.join(LOCAL_TEMPLATES_DIR, cleanName);
        if (fs.existsSync(localPath)) {
            try { fs.unlinkSync(localPath); } catch (_) {}
        }

        // Delete from Google Drive
        try {
            const drive = googleDriveService.getDrive();
            const folderId = await this.getTemplatesFolderId();
            const safeName = cleanName.replace(/'/g, "\\'");
            const query = `name = '${safeName}' and '${folderId}' in parents and trashed = false`;
            const res = await drive.files.list({
                q: query,
                fields: 'files(id, name)',
                spaces: 'drive'
            });

            if (res.data.files && res.data.files.length > 0) {
                for (const f of res.data.files) {
                    await drive.files.delete({ fileId: f.id });
                    console.log(`🗑️ Plantilla "${cleanName}" eliminada de Google Drive (ID: ${f.id})`);
                }
            }
        } catch (driveErr) {
            console.warn(`⚠️ Error al eliminar plantilla de Google Drive:`, driveErr.message);
        }

        return true;
    }

    /**
     * Synchronizes all existing local templates to Google Drive.
     * Useful on startup or initial migration.
     */
    async syncAllLocalToDrive() {
        if (!fs.existsSync(LOCAL_TEMPLATES_DIR)) return [];

        const files = fs.readdirSync(LOCAL_TEMPLATES_DIR)
            .filter(f => !f.startsWith('.') && !f.endsWith('.bak') && (f.endsWith('.docx') || f.endsWith('.doc')));

        const results = [];
        for (const file of files) {
            const filePath = path.join(LOCAL_TEMPLATES_DIR, file);
            const buffer = fs.readFileSync(filePath);
            const res = await this.saveTemplate(buffer, file);
            results.push(res);
        }
        return results;
    }
}

module.exports = new TemplateService();

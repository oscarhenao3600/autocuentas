const { google } = require('googleapis');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

class GoogleDriveService {
    constructor() {
        this.drive = null;
        this.oauth2Client = null;
        this.folderCache = new Map(); // pathString -> folderId
        this.rootFolderName = process.env.GOOGLE_DRIVE_ROOT_FOLDER || 'AutoCuentas';
        this.rootFolderId = null;
        this.isInitialized = false;
    }

    /**
     * Initializes OAuth2 client using credentials and saved tokens
     */
    init() {
        if (this.isInitialized && this.drive) return this.drive;

        const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

        // Try reading from token.json if env vars missing
        let tokens = null;
        const tokenFile = path.join(__dirname, '..', 'token.json');
        if (fs.existsSync(tokenFile)) {
            try {
                tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
            } catch (_) {}
        }

        const effectiveRefreshToken = refreshToken || (tokens && tokens.refresh_token);

        if (!clientId || !clientSecret || !effectiveRefreshToken) {
            console.warn('⚠️ Google Drive: Faltan credenciales en .env o token.json.');
            return null;
        }

        this.oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            'http://localhost:3000'
        );

        this.oauth2Client.setCredentials({
            refresh_token: effectiveRefreshToken,
            ...(tokens || {})
        });

        // Save newly refreshed tokens if updated
        this.oauth2Client.on('tokens', (newTokens) => {
            try {
                const current = fs.existsSync(tokenFile) ? JSON.parse(fs.readFileSync(tokenFile, 'utf8')) : {};
                const merged = { ...current, ...newTokens };
                fs.writeFileSync(tokenFile, JSON.stringify(merged, null, 2));
            } catch (_) {}
        });

        this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
        this.isInitialized = true;
        console.log('✅ Google Drive Service inicializado con éxito');
        return this.drive;
    }

    getDrive() {
        if (!this.drive) {
            this.init();
        }
        if (!this.drive) {
            throw new Error('Google Drive Service no está configurado');
        }
        return this.drive;
    }

    /**
     * Resolves or creates the main root folder in Google Drive (e.g. "AutoCuentas")
     */
    async getRootFolderId() {
        if (this.rootFolderId) return this.rootFolderId;
        const drive = this.getDrive();

        const query = `name = '${this.rootFolderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const res = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (res.data.files && res.data.files.length > 0) {
            this.rootFolderId = res.data.files[0].id;
        } else {
            const folderMetadata = {
                name: this.rootFolderName,
                mimeType: 'application/vnd.google-apps.folder'
            };
            const folder = await drive.files.create({
                resource: folderMetadata,
                fields: 'id'
            });
            this.rootFolderId = folder.data.id;
            console.log(`📁 Carpeta principal creada en Drive: ${this.rootFolderName} (ID: ${this.rootFolderId})`);
        }

        this.folderCache.set(this.rootFolderName, this.rootFolderId);
        return this.rootFolderId;
    }

    /**
     * Determines whether files should go to 'dev' or 'prod' folder
     */
    getEnvFolder() {
        const raw = process.env.GOOGLE_DRIVE_ENV || (process.env.NODE_ENV === 'production' ? 'prod' : 'dev');
        const clean = String(raw).toLowerCase().trim();
        return clean === 'prod' || clean === 'production' ? 'prod' : 'dev';
    }

    /**
     * Ensures an existing nested folder path under the environment folder (dev/prod),
     * creating folders along the way: AutoCuentas -> dev|prod -> ...pathSegments
     */
    async ensureFolderPath(pathSegments = []) {
        const envFolder = this.getEnvFolder();
        // If pathSegments doesn't already start with 'dev' or 'prod', prepend the current environment
        const normalized = (pathSegments.length > 0 && ['dev', 'prod'].includes(String(pathSegments[0]).toLowerCase().trim()))
            ? pathSegments
            : [envFolder, ...pathSegments];

        const drive = this.getDrive();
        let parentId = await this.getRootFolderId();
        let currentPath = this.rootFolderName;

        for (const segment of normalized) {
            const safeSegment = String(segment).replace(/[/\\?%*:|"<>]/g, '_').trim() || 'General';
            currentPath += `/${safeSegment}`;

            if (this.folderCache.has(currentPath)) {
                parentId = this.folderCache.get(currentPath);
                continue;
            }

            const query = `name = '${safeSegment}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const res = await drive.files.list({
                q: query,
                fields: 'files(id, name)',
                spaces: 'drive'
            });

            if (res.data.files && res.data.files.length > 0) {
                parentId = res.data.files[0].id;
            } else {
                const folderMetadata = {
                    name: safeSegment,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [parentId]
                };
                const created = await drive.files.create({
                    resource: folderMetadata,
                    fields: 'id'
                });
                parentId = created.data.id;
            }

            this.folderCache.set(currentPath, parentId);
        }

        return parentId;
    }

    /**
     * Uploads a Buffer directly to Google Drive
     */
    async uploadBuffer({ buffer, filename, mimeType, pathSegments = [] }) {
        const drive = this.getDrive();
        const parentId = await this.ensureFolderPath(pathSegments);

        const safeFilename = path.basename(filename || 'archivo');
        const readableStream = Readable.from(buffer);

        const fileMetadata = {
            name: safeFilename,
            parents: [parentId]
        };

        const media = {
            mimeType: mimeType || 'application/octet-stream',
            body: readableStream
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, mimeType, size, webViewLink, webContentLink'
        });

        const fileData = response.data;
        return {
            fileId: fileData.id,
            filename: fileData.name,
            mimeType: fileData.mimeType,
            size: fileData.size ? parseInt(fileData.size, 10) : buffer.length,
            webViewLink: fileData.webViewLink,
            webContentLink: fileData.webContentLink
        };
    }

    /**
     * Downloads file as in-memory Buffer
     */
    async downloadBuffer(fileId) {
        const drive = this.getDrive();
        const res = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'arraybuffer' }
        );
        return Buffer.from(res.data);
    }

    /**
     * Returns a readable stream of the file content
     */
    async getFileStream(fileId) {
        const drive = this.getDrive();
        const res = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'stream' }
        );
        return res.data;
    }

    /**
     * Gets file metadata (name, mimeType, size)
     */
    async getMetadata(fileId) {
        const drive = this.getDrive();
        const res = await drive.files.get({
            fileId: fileId,
            fields: 'id, name, mimeType, size, md5Checksum'
        });
        return res.data;
    }

    /**
     * Deletes a file from Drive
     */
    async deleteFile(fileId) {
        try {
            const drive = this.getDrive();
            await drive.files.delete({ fileId: fileId });
            return true;
        } catch (err) {
            console.warn(`Aviso al eliminar archivo ${fileId} en Drive:`, err.message);
            return false;
        }
    }
}

module.exports = new GoogleDriveService();

const fs = require('fs');
const path = require('path');
const googleDriveService = require('./googleDrive.service');

class StorageService {
    /**
     * Extracts a Google Drive File ID from various formats:
     * - "125Kovot7OV_X7b51rmIZNSs3q033MS9Q"
     * - "/api/drive/file/125Kovot7OV_X7b51rmIZNSs3q033MS9Q/nombre.pdf"
     * - "/uploads/gdrive_125Kovot7OV_X7b51rmIZNSs3q033MS9Q.pdf"
     * - "https://drive.google.com/uc?id=125Kovot7OV_X7b51rmIZNSs3q033MS9Q"
     * - "gdrive://125Kovot7OV_X7b51rmIZNSs3q033MS9Q"
     */
    extractDriveId(input) {
        if (!input || typeof input !== 'string') return null;
        const clean = input.trim();

        // Direct 25-50 char Google Drive alphanumeric ID with hyphens or underscores
        if (/^[a-zA-Z0-9_-]{25,55}$/.test(clean)) {
            return clean;
        }

        // Match /api/drive/file/:fileId or /api/drive/download/:fileId
        const apiMatch = clean.match(/\/api\/drive\/(?:file|download)\/([a-zA-Z0-9_-]{25,55})/i);
        if (apiMatch) return apiMatch[1];

        // Match gdrive://:fileId
        const protoMatch = clean.match(/gdrive:\/\/([a-zA-Z0-9_-]{25,55})/i);
        if (protoMatch) return protoMatch[1];

        // Match drive.google.com URL with id= or /d/:id
        const urlIdMatch = clean.match(/[?&]id=([a-zA-Z0-9_-]{25,55})/i);
        if (urlIdMatch) return urlIdMatch[1];
        const urlDMatch = clean.match(/\/d\/([a-zA-Z0-9_-]{25,55})/i);
        if (urlDMatch) return urlDMatch[1];

        // Match filename with prefix gdrive_: e.g. gdrive_125Kovot7OV_X7b51rmIZNSs3q033MS9Q
        const prefixMatch = clean.match(/gdrive_([a-zA-Z0-9_-]{25,55})/i);
        if (prefixMatch) return prefixMatch[1];

        return null;
    }

    /**
     * Resolves a local path on disk safely within permitted application directories (uploads, generated, templates).
     * Prevents arbitrary file reads and path traversal attacks (e.g. leaking .env or system files).
     */
    resolveLocalPath(filePath) {
        if (!filePath || typeof filePath !== 'string') return null;
        if (filePath.includes('\0')) return null;

        const backendRoot = path.resolve(__dirname, '..');
        const allowedDirs = [
            path.join(backendRoot, 'uploads'),
            path.join(backendRoot, 'generated'),
            path.join(backendRoot, 'templates')
        ];

        const rawClean = filePath.trim().replace(/^[\/\\]+/, '');
        const candidates = [];

        if (path.isAbsolute(filePath)) {
            candidates.push(path.resolve(filePath));
        }

        // Relative candidates
        candidates.push(path.resolve(backendRoot, rawClean));
        candidates.push(path.resolve(backendRoot, 'uploads', rawClean));
        candidates.push(path.resolve(backendRoot, 'generated', rawClean));

        for (const candidate of candidates) {
            try {
                // Ensure candidate is strictly within one of the allowed directories
                const isInsideAllowed = allowedDirs.some(allowedDir => {
                    const relative = path.relative(allowedDir, candidate);
                    return !relative.startsWith('..') && !path.isAbsolute(relative);
                });

                if (isInsideAllowed && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                    return candidate;
                }
            } catch (_) {}
        }

        return null;
    }

    /**
     * Saves a buffer to Google Drive.
     * Returns standard file descriptor with proxy URL for frontend/downloads.
     */
    async saveFile({ buffer, filename, mimetype, pathSegments = [] }) {
        if (!buffer) {
            throw new Error('No se proporcionó buffer de archivo para guardar');
        }

        const safeFilename = path.basename(filename || `archivo_${Date.now()}`);

        // Prepare local path as contingency / fallback
        const uploadsDir = path.resolve(__dirname, '..', 'uploads', ...pathSegments);
        const localFilePath = path.join(uploadsDir, safeFilename);
        const relPath = path.relative(path.resolve(__dirname, '..'), localFilePath).replace(/\\/g, '/');

        try {
            const driveResult = await googleDriveService.uploadBuffer({
                buffer,
                filename: safeFilename,
                mimeType: mimetype,
                pathSegments
            });

            const proxyPath = `/api/drive/file/${driveResult.fileId}/${encodeURIComponent(safeFilename)}`;

            return {
                path: proxyPath,
                localPath: localFilePath,
                driveId: driveResult.fileId,
                filename: safeFilename,
                mimetype: driveResult.mimeType || mimetype,
                size: driveResult.size,
                webViewLink: driveResult.webViewLink,
                webContentLink: driveResult.webContentLink
            };
        } catch (driveErr) {
            console.warn(`⚠️ Error subiendo a Google Drive (${driveErr.message}). Activando almacenamiento local de contingencia en disco.`);

            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            fs.writeFileSync(localFilePath, buffer);

            return {
                path: relPath,
                localPath: localFilePath,
                driveId: null,
                filename: safeFilename,
                mimetype: mimetype || 'application/octet-stream',
                size: buffer.length,
                isLocalFallback: true,
                driveError: driveErr.message
            };
        }
    }

    /**
     * Retrieves file content as in-memory Buffer from Drive or local disk
     */
    async getFileBuffer(pathOrDriveId) {
        if (!pathOrDriveId) return null;
        if (Buffer.isBuffer(pathOrDriveId)) return pathOrDriveId;

        // 1. Check if it corresponds to a Google Drive File ID
        const driveId = this.extractDriveId(pathOrDriveId);
        if (driveId) {
            try {
                return await googleDriveService.downloadBuffer(driveId);
            } catch (err) {
                console.warn(`⚠️ Error descargando buffer de Drive (${driveId}):`, err.message);
            }
        }

        // 2. Check if it's on local disk
        const local = this.resolveLocalPath(pathOrDriveId);
        if (local) {
            try {
                return fs.readFileSync(local);
            } catch (err) {
                console.warn(`⚠️ Error leyendo archivo local (${local}):`, err.message);
            }
        }

        return null;
    }

    /**
     * Retrieves file as a readable stream from Drive or local disk
     */
    async getFileStream(pathOrDriveId) {
        if (!pathOrDriveId) return null;

        const driveId = this.extractDriveId(pathOrDriveId);
        if (driveId) {
            return await googleDriveService.getFileStream(driveId);
        }

        const local = this.resolveLocalPath(pathOrDriveId);
        if (local) {
            return fs.createReadStream(local);
        }

        return null;
    }

    /**
     * Gets file metadata (name, mimeType, size)
     */
    async getMetadata(pathOrDriveId) {
        if (!pathOrDriveId) return null;

        const driveId = this.extractDriveId(pathOrDriveId);
        if (driveId) {
            return await googleDriveService.getMetadata(driveId);
        }

        const local = this.resolveLocalPath(pathOrDriveId);
        if (local) {
            const stat = fs.statSync(local);
            return {
                name: path.basename(local),
                size: stat.size
            };
        }

        return null;
    }

    /**
     * Deletes file from Drive or disk
     */
    async deleteFile(pathOrDriveId) {
        const driveId = this.extractDriveId(pathOrDriveId);
        if (driveId) {
            return await googleDriveService.deleteFile(driveId);
        }

        const local = this.resolveLocalPath(pathOrDriveId);
        if (local) {
            try {
                fs.unlinkSync(local);
                return true;
            } catch (_) {
                return false;
            }
        }

        return false;
    }
}

module.exports = new StorageService();

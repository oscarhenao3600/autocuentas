const express = require('express');
const router = express.Router();
const storageService = require('../services/storage.service');
const googleDriveService = require('../services/googleDrive.service');

const handleStream = async (req, res, isInline = true) => {
    try {
        const { fileId } = req.params;
        const driveId = storageService.extractDriveId(fileId) || fileId;

        try {
            const metadata = await googleDriveService.getMetadata(driveId);
            const fileName = req.params.filename || metadata.name || 'archivo';
            const mimeType = metadata.mimeType || 'application/octet-stream';

            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(fileName)}"`);
            if (isInline) {
                res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24 hours
            }

            const stream = await googleDriveService.getFileStream(driveId);
            return stream.pipe(res);
        } catch (driveErr) {
            // Fallback: check if file is stored locally
            const localBuffer = await storageService.getFileBuffer(req.params.filename || fileId);
            if (localBuffer) {
                const fileName = req.params.filename || 'archivo';
                res.setHeader('Content-Disposition', `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(fileName)}"`);
                return res.send(localBuffer);
            }
            throw driveErr;
        }
    } catch (err) {
        console.error('Error al procesar archivo de Google Drive:', err.message);
        res.status(404).json({ message: 'Archivo no encontrado en Google Drive ni almacenamiento local', error: err.message });
    }
};

/**
 * Stream file inline (view in browser / display image)
 */
router.get('/file/:fileId', (req, res) => handleStream(req, res, true));
router.get('/file/:fileId/:filename', (req, res) => handleStream(req, res, true));

/**
 * Stream file as attachment (download)
 */
router.get('/download/:fileId', (req, res) => handleStream(req, res, false));
router.get('/download/:fileId/:filename', (req, res) => handleStream(req, res, false));

module.exports = router;

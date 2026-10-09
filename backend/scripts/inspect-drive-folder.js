const googleDriveService = require('../services/googleDrive.service');

async function inspectDriveFolder() {
    try {
        const drive = googleDriveService.getDrive();
        const folderId = '14Jc9G7573rYuj5v6-Yo3wsvCPU4iU4g-';

        console.log(`Buscando archivos en la carpeta de Google Drive: ${folderId}...`);
        const res = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, size, webViewLink, webContentLink)',
            spaces: 'drive'
        });

        console.log('Archivos encontrados:', res.data.files);
        process.exit(0);
    } catch (err) {
        console.error('Error al inspeccionar carpeta de Google Drive:', err.message);
        process.exit(1);
    }
}

inspectDriveFolder();

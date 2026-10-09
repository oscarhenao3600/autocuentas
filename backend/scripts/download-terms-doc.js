const fs = require('fs');
const path = require('path');
const googleDriveService = require('../services/googleDrive.service');

async function downloadTerms() {
    try {
        const fileId = '18d0e_EDZs1Z_f7HfL259yH6cIUycGqeC';
        console.log(`Descargando archivo oficial de Términos y Condiciones (${fileId})...`);

        const buffer = await googleDriveService.downloadBuffer(fileId);
        console.log(`Buffer descargado. Tamaño: ${buffer.length} bytes`);

        const templatesDir = path.join(__dirname, '..', 'templates');
        if (!fs.existsSync(templatesDir)) {
            fs.mkdirSync(templatesDir, { recursive: true });
        }

        const targetPath = path.join(templatesDir, 'Terminos-Condiciones-Autocuentas.pdf');
        fs.writeFileSync(targetPath, buffer);
        console.log(`✅ Archivo guardado con éxito en: ${targetPath}`);

        // También guardar en backend/uploads para disponibilidad general
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const uploadsTargetPath = path.join(uploadsDir, 'Terminos-Condiciones-Autocuentas.pdf');
        fs.writeFileSync(uploadsTargetPath, buffer);
        console.log(`✅ Archivo guardado con éxito en: ${uploadsTargetPath}`);

        process.exit(0);
    } catch (err) {
        console.error('Error al descargar términos:', err);
        process.exit(1);
    }
}

downloadTerms();

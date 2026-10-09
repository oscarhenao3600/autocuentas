const fs = require('fs');
const path = require('path');

const pdfPath = path.join(__dirname, '..', 'templates', 'Terminos-Condiciones-Autocuentas.pdf');
const buffer = fs.readFileSync(pdfPath);
const base64 = buffer.toString('base64');

const fileContent = `/**
 * UTILIDAD DE RESOLUCIÓN Y AUTORRECUPERACIÓN DE TÉRMINOS Y CONDICIONES PDF
 * Diseñado para ser 100% tolerante a fallos en Linux / Raspberry Pi:
 * - Búsqueda insensible a mayúsculas/minúsculas (case-insensitive).
 * - Soporte para variaciones de nombres de carpeta: templates, templet, template, uploads.
 * - Autorrecuperación: si no existe en disco, se autodescarga de Google Drive o se autogenera desde Base64 embebido.
 */

const fs = require('fs');
const path = require('path');

// Respaldo binario embebido oficial (35.9 KB) para entornos sin conexión o sin volumen montado
const EMBEDDED_TERMS_PDF_BASE64 = '${base64}';

/**
 * Busca de forma insensible a mayúsculas y minúsculas en múltiples carpetas
 */
function findTermsPdfOnDisk() {
    const candidateFolders = [
        // Rutas relativas a __dirname (backend/utils)
        path.join(__dirname, '..', 'templates'),
        path.join(__dirname, '..', 'templet'),
        path.join(__dirname, '..', 'template'),
        path.join(__dirname, '..', 'uploads'),
        // Rutas absolutas estándar en Docker (/app)
        '/app/templates',
        '/app/templet',
        '/app/template',
        '/app/uploads',
        // Rutas relativas al proceso de ejecución
        path.resolve('templates'),
        path.resolve('templet'),
        path.resolve('template'),
        path.resolve('backend/templates'),
        path.resolve('backend/templet'),
        path.resolve('backend/template'),
        path.resolve('uploads')
    ];

    for (const folder of candidateFolders) {
        try {
            if (fs.existsSync(folder)) {
                const files = fs.readdirSync(folder);
                // Búsqueda case-insensitive para cualquier variación
                const match = files.find(f => 
                    /terminos|condiciones/i.test(f) && f.toLowerCase().endsWith('.pdf')
                );
                if (match) {
                    const fullPath = path.join(folder, match);
                    const stats = fs.statSync(fullPath);
                    if (stats.size > 1000) {
                        return fullPath;
                    }
                }
            }
        } catch (_) {}
    }

    return null;
}

/**
 * Obtiene el buffer del archivo PDF garantizando que NUNCA sea nulo.
 * Si no está en disco, lo autogenera inmediatamente en las carpetas templates y templet.
 */
async function getTermsPdfBuffer() {
    // 1. Intentar encontrar en disco
    const onDiskPath = findTermsPdfOnDisk();
    if (onDiskPath) {
        try {
            const buf = fs.readFileSync(onDiskPath);
            if (buf && buf.length > 1000) {
                return { buffer: buf, path: onDiskPath, filename: path.basename(onDiskPath) };
            }
        } catch (readErr) {
            console.warn('⚠️ Error leyendo archivo en disco:', readErr.message);
        }
    }

    // 2. Intentar descargar de Google Drive si el servicio está disponible
    try {
        const googleDriveService = require('../services/googleDrive.service');
        const driveId = '18d0e_EDZs1Z_f7HfL259yH6cIUycGqeC';
        const driveBuf = await googleDriveService.downloadBuffer(driveId);
        if (driveBuf && driveBuf.length > 1000) {
            saveBufferToTemplates(driveBuf);
            return { buffer: driveBuf, path: null, filename: 'Terminos-Condiciones-Autocuentas.pdf' };
        }
    } catch (_) {}

    // 3. Autorrecuperación con binario embebido
    console.log('⚡ Autogenerando Terminos-Condiciones-Autocuentas.pdf desde respaldo embebido...');
    const embeddedBuf = Buffer.from(EMBEDDED_TERMS_PDF_BASE64, 'base64');
    const savedPath = saveBufferToTemplates(embeddedBuf);
    return { buffer: embeddedBuf, path: savedPath, filename: 'Terminos-Condiciones-Autocuentas.pdf' };
}

/**
 * Guarda el buffer en templates y templet para que quede persistente
 */
function saveBufferToTemplates(buffer) {
    const targetDirs = [
        path.join(__dirname, '..', 'templates'),
        path.join(__dirname, '..', 'templet'),
        path.join(__dirname, '..', 'uploads'),
        '/app/templates',
        '/app/templet'
    ];

    let savedPath = null;
    for (const dir of targetDirs) {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const filePath = path.join(dir, 'Terminos-Condiciones-Autocuentas.pdf');
            fs.writeFileSync(filePath, buffer);
            if (!savedPath) savedPath = filePath;
        } catch (_) {}
    }
    return savedPath;
}

module.exports = {
    findTermsPdfOnDisk,
    getTermsPdfBuffer,
    saveBufferToTemplates
};
`;

const outputPath = path.join(__dirname, '..', 'utils', 'terms_pdf.js');
fs.writeFileSync(outputPath, fileContent, 'utf-8');
console.log('✅ Archivo utils/terms_pdf.js generado con éxito:', outputPath);

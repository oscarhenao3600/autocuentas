const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

/**
 * Genera el paquete comprimido (.zip) con todos los formatos y evidencias organizados
 * Utiliza PizZip para compatibilidad multiplataforma nativa (Windows, Linux, Docker, etc.)
 * @param {Object} billingPeriod - El periodo de cobro con sus actividades y evidencias
 * @param {Object} contract - El contrato base con los anexos
 * @param {Object} user - El usuario contratista
 * @returns {Promise<string>} - La ruta del archivo comprimido generado
 */
exports.createBillingZip = async (billingPeriod, contract, user) => {
    const outputDir = path.join(__dirname, '..', 'generated');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Formatear nombre de archivo final
    const safeName = (user.fullName || 'Contratista').replace(/[^a-zA-Z0-9]/g, '_');
    const zipName = `Cuenta_Cobro_${safeName}_Acta_${billingPeriod.actNumber}.zip`;
    const zipPath = path.join(outputDir, zipName);

    try {
        const zip = new PizZip();

        // Helper para resolver rutas de manera segura y agnóstica al SO/Docker
        const resolveSafePath = (filePath) => {
            if (!filePath) return null;
            if (path.isAbsolute(filePath) && fs.existsSync(filePath)) return filePath;
            if (fs.existsSync(filePath)) return path.resolve(filePath);
            const fromBackend = path.resolve(__dirname, '..', filePath);
            if (fs.existsSync(fromBackend)) return fromBackend;
            const normalized = filePath.replace(/\\/g, '/');
            const fromBackendNorm = path.resolve(__dirname, '..', normalized);
            if (fs.existsSync(fromBackendNorm)) return fromBackendNorm;
            return null;
        };

        // Helper para agregar archivo al ZIP de forma segura
        const addFileToZip = (srcPath, zipRelativePath) => {
            const resolved = resolveSafePath(srcPath);
            if (resolved) {
                try {
                    const data = fs.readFileSync(resolved);
                    zip.file(zipRelativePath, data);
                    return true;
                } catch (e) {
                    console.warn(`⚠️ No se pudo leer archivo ${resolved}:`, e.message);
                }
            } else {
                console.warn(`⚠️ Archivo no encontrado para ${zipRelativePath}: ${srcPath}`);
            }
            return false;
        };

        const getZipDest = (baseName, srcPath, defaultExt = '.pdf') => {
            const ext = srcPath ? (path.extname(srcPath) || defaultExt) : defaultExt;
            return `${baseName}${ext}`;
        };

        // 1. Copiar los 4 formatos Word generados (.docx)
        const generatedFiles = [
            { field: 'certificadoPath',  dest: '1-CERTIFICADO DEL SUPERVISOR.docx' },
            { field: 'informePath',      dest: '2-INFORME DE ACTIVIDADES.docx' },
            { field: 'estampillasPath',  dest: '3-DESCUENTO DE ESTAMPILLAS.docx' },
            { field: 'retencionPath',    dest: '4-RETENCION EN LA FUENTE.docx' }
        ];

        generatedFiles.forEach(file => {
            const srcPath = billingPeriod[file.field];
            if (!addFileToZip(srcPath, file.dest)) {
                console.warn(`⚠️ Archivo no encontrado para ${file.dest}: ${srcPath}`);
            }
        });

        // 2. Copiar documentos anexos oficiales del contrato
        if (contract) {
            if (contract.actaInicioPath) addFileToZip(contract.actaInicioPath, getZipDest('5-ACTA DE INICIO', contract.actaInicioPath));
            if (contract.rpPath) addFileToZip(contract.rpPath, getZipDest('6-REGISTRO PRESUPUESTAL', contract.rpPath));
            if (contract.baseDocumentPath) addFileToZip(contract.baseDocumentPath, getZipDest('7-MINUTA DEL CONTRATO', contract.baseDocumentPath));

            // Adición contractual (si aplica)
            if (contract.additionRpPath) addFileToZip(contract.additionRpPath, getZipDest('6B-RP ADICION', contract.additionRpPath));
            if (contract.additionDocumentPath) addFileToZip(contract.additionDocumentPath, getZipDest('7B-MODIFICATORIO ADICION', contract.additionDocumentPath));

            if (contract.rutPath) addFileToZip(contract.rutPath, getZipDest('8-RUT', contract.rutPath));
            if (contract.bankCertificatePath) addFileToZip(contract.bankCertificatePath, getZipDest('9-CERTIFICADO DE CUENTA BANCARIA', contract.bankCertificatePath));

            const ssPath = billingPeriod.securitySocialPath || contract.securitySocialPath;
            if (ssPath) addFileToZip(ssPath, getZipDest('10-PLANILLA DE SEGURIDAD SOCIAL', ssPath));
        }

        // 3. Copiar evidencias por actividad en subcarpetas estructuradas (ej: 2.2.1, 2.2.2)
        if (billingPeriod.activities && billingPeriod.activities.length > 0) {
            billingPeriod.activities.forEach((act) => {
                const actFolderCode = act.obligationCode || 'Actividad';
                
                if (act.evidences && act.evidences.length > 0) {
                    act.evidences.forEach((evidence, index) => {
                        const evPath = evidence.path;
                        if (evPath) {
                            const ext = path.extname(evidence.filename || evPath) || '.jpg';
                            const mime = (evidence.mimetype || '').toLowerCase();
                            const isImg = mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp'].includes(ext.toLowerCase());
                            
                            let destFileName;
                            if (isImg) {
                                destFileName = `${actFolderCode}/Foto_${index + 1}${ext}`;
                            } else {
                                const countSuffix = act.evidences.length > 1 ? `_${index + 1}` : '';
                                destFileName = `${actFolderCode}/Anexo_${actFolderCode}${countSuffix}${ext}`;
                            }
                            addFileToZip(evPath, destFileName);
                        }
                    });
                }
            });
        }

        // 4. Generar archivo comprimido .zip en memoria y escribir a disco
        const zipBuffer = zip.generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        fs.writeFileSync(zipPath, zipBuffer);
        console.log(`✅ Archivo comprimido creado con éxito en: ${zipPath}`);
        return zipPath;

    } catch (error) {
        console.error('❌ Error al comprimir el paquete de cobro con PizZip:', error.message);
        throw new Error('No se pudo generar el archivo comprimido con los soportes');
    }
};

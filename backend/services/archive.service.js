const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const storageService = require('./storage.service');

/**
 * Genera el paquete comprimido (.zip) con todos los formatos y evidencias organizados.
 * Ahora descarga soportes desde Google Drive o disco local transparentemente
 * y guarda el ZIP final tanto en Google Drive como en disco local.
 * 
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

        // Helper para agregar archivo al ZIP leyendo desde Google Drive o disco
        const addFileToZip = async (srcPath, zipRelativePath) => {
            if (!srcPath) return false;
            try {
                const buffer = await storageService.getFileBuffer(srcPath);
                if (buffer) {
                    zip.file(zipRelativePath, buffer);
                    return true;
                }
            } catch (e) {
                console.warn(`⚠️ No se pudo obtener archivo para ${zipRelativePath} (${srcPath}):`, e.message);
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

        for (const file of generatedFiles) {
            const srcPath = billingPeriod[file.field];
            await addFileToZip(srcPath, file.dest);
        }

        // 2. Copiar documentos anexos oficiales del contrato
        if (contract) {
            if (contract.actaInicioPath) await addFileToZip(contract.actaInicioPath, getZipDest('5-ACTA DE INICIO', contract.actaInicioPath));
            if (contract.rpPath) await addFileToZip(contract.rpPath, getZipDest('6-REGISTRO PRESUPUESTAL', contract.rpPath));
            if (contract.baseDocumentPath) await addFileToZip(contract.baseDocumentPath, getZipDest('7-MINUTA DEL CONTRATO', contract.baseDocumentPath));

            // Adición contractual (si aplica)
            if (contract.additionRpPath) await addFileToZip(contract.additionRpPath, getZipDest('6B-RP ADICION', contract.additionRpPath));
            if (contract.additionDocumentPath) await addFileToZip(contract.additionDocumentPath, getZipDest('7B-MODIFICATORIO ADICION', contract.additionDocumentPath));

            if (contract.rutPath) await addFileToZip(contract.rutPath, getZipDest('8-RUT', contract.rutPath));
            if (contract.bankCertificatePath) await addFileToZip(contract.bankCertificatePath, getZipDest('9-CERTIFICADO DE CUENTA BANCARIA', contract.bankCertificatePath));

            const ssPath = billingPeriod.securitySocialPath || contract.securitySocialPath;
            if (ssPath) await addFileToZip(ssPath, getZipDest('10-PLANILLA DE SEGURIDAD SOCIAL', ssPath));
        }

        // 3. Copiar evidencias y Anexo Descripción por actividad en subcarpetas estructuradas (ej: 2.2.1, 2.2.2)
        if (billingPeriod.activities && billingPeriod.activities.length > 0) {
            for (const act of billingPeriod.activities) {
                const actFolderCode = (act.obligationCode || 'Actividad').trim().replace(/[^a-zA-Z0-9.-]/g, '_');
                
                // Incluir el documento oficial "Anexo Descripcion #[codigo].docx"
                const annexPath = act.annexDocPath || act.annexDriveId;
                if (annexPath) {
                    await addFileToZip(annexPath, `${actFolderCode}/Anexo Descripcion ${actFolderCode}.docx`);
                }

                if (act.evidences && act.evidences.length > 0) {
                    for (let index = 0; index < act.evidences.length; index++) {
                        const evidence = act.evidences[index];
                        const evPath = evidence.path || evidence.driveId;
                        if (evPath) {
                            const ext = path.extname(evidence.filename || evPath) || '.jpg';
                            const mime = (evidence.mimetype || '').toLowerCase();
                            const isImg = mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp'].includes(ext.toLowerCase());
                            
                            let destFileName;
                            if (isImg) {
                                destFileName = `${actFolderCode}/Foto_${index + 1}${ext}`;
                            } else {
                                const countSuffix = act.evidences.length > 1 ? `_${index + 1}` : '';
                                destFileName = `${actFolderCode}/Soporte_${actFolderCode}${countSuffix}${ext}`;
                            }
                            await addFileToZip(evPath, destFileName);
                        }
                    }
                }
            }
        }

        // 4. Generar archivo comprimido .zip en memoria
        const zipBuffer = zip.generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        // 5. Guardar ZIP en Google Drive en la carpeta del contratista
        try {
            const contractorFolder = `${contract?.idNumber || user?.cedula || user?._id}_${safeName}`;
            const driveUpload = await storageService.saveFile({
                buffer: zipBuffer,
                filename: zipName,
                mimetype: 'application/zip',
                pathSegments: ['Contratistas', contractorFolder, `Acta_${billingPeriod.actNumber}`, 'Paquetes_ZIP']
            });
            billingPeriod.zipDriveId = driveUpload.driveId;
            console.log(`☁️ Paquete ZIP guardado en Google Drive: ${driveUpload.path} (ID: ${driveUpload.driveId})`);
        } catch (driveErr) {
            console.warn('⚠️ No se pudo respaldar el ZIP en Google Drive (se mantiene copia local):', driveErr.message);
        }

        // 6. Guardar copia local en generated/ para descarga directa
        fs.writeFileSync(zipPath, zipBuffer);
        console.log(`✅ Archivo comprimido creado con éxito en: ${zipPath}`);
        return zipPath;

    } catch (error) {
        console.error('❌ Error al comprimir el paquete de cobro con PizZip:', error.message);
        throw new Error('No se pudo generar el archivo comprimido con los soportes');
    }
};

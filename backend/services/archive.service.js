const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Genera el paquete comprimido (.zip) con todos los formatos y evidencias organizados
 * @param {Object} billingPeriod - El periodo de cobro con sus actividades y evidencias
 * @param {Object} contract - El contrato base con los anexos
 * @param {Object} user - El usuario contratista
 * @returns {Promise<string>} - La ruta del archivo comprimido generado
 */
exports.createBillingZip = async (billingPeriod, contract, user) => {
    const tempDirName = `temp_${billingPeriod._id}_${Date.now()}`;
    const tempDirPath = path.join(__dirname, '..', 'generated', tempDirName);
    const outputDir = path.join(__dirname, '..', 'generated');
    
    // Formatear nombre de archivo final
    const safeName = user.fullName.replace(/[^a-zA-Z0-9]/g, '_');
    const zipName = `Cuenta_Cobro_${safeName}_Acta_${billingPeriod.actNumber}.zip`;
    const zipPath = path.join(outputDir, zipName);

    try {
        // 1. Crear directorio temporal
        if (!fs.existsSync(tempDirPath)) {
            fs.mkdirSync(tempDirPath, { recursive: true });
        }

        // Helper para copiar archivos de forma segura
        const copyFileSafe = (srcPath, destName) => {
            if (srcPath && fs.existsSync(srcPath)) {
                const destPath = path.join(tempDirPath, destName);
                fs.copyFileSync(srcPath, destPath);
                return true;
            }
            return false;
        };

        // 2. Copiar formatos generados (.docx)
        // billing.controller sets: certificadoPath, informePath, estampillasPath, retencionPath
        const generatedFiles = [
            { field: 'certificadoPath',  dest: '1-CERTIFICADO DEL SUPERVISOR.docx' },
            { field: 'informePath',      dest: '2-INFORME DE ACTIVIDADES.docx' },
            { field: 'estampillasPath',  dest: '3-DESCUENTO DE ESTAMPILLAS.docx' },
            { field: 'retencionPath',    dest: '4-RETENCION EN LA FUENTE.docx' }
        ];

        generatedFiles.forEach(file => {
            const srcPath = billingPeriod[file.field];
            if (srcPath && fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, path.join(tempDirPath, file.dest));
            } else {
                console.warn(`⚠️ Archivo no encontrado para ${file.dest}: ${srcPath}`);
            }
        });

        // 3. Copiar documentos anexos del contrato
        if (contract) {
            copyFileSafe(contract.rutPath, '8-RUT.pdf');
            copyFileSafe(contract.bankCertificatePath, '9-CERTIFICADO DE CUENTA BANCARIA.pdf');
            // Nota: El contratista sube la Planilla de seguridad social del mes respectivo
            // y la cargaremos desde el periodo de cobro o contrato
            if (billingPeriod.securitySocialPath) {
                copyFileSafe(billingPeriod.securitySocialPath, '10-PLANILLA DE SEGURIDAD SOCIAL.pdf');
            } else if (contract.securitySocialPath) {
                copyFileSafe(contract.securitySocialPath, '10-PLANILLA DE SEGURIDAD SOCIAL.pdf');
            }
        }

        // 4. Copiar evidencias por actividad en subcarpetas estructuradas
        if (billingPeriod.activities && billingPeriod.activities.length > 0) {
            billingPeriod.activities.forEach((act) => {
                // Crear carpeta para la actividad (ej: '2.2.1')
                const actFolderCode = act.obligationCode || 'Actividad';
                const actFolderPath = path.join(tempDirPath, actFolderCode);
                
                if (act.evidences && act.evidences.length > 0) {
                    if (!fs.existsSync(actFolderPath)) {
                        fs.mkdirSync(actFolderPath, { recursive: true });
                    }
                    
                    act.evidences.forEach((evidence, index) => {
                        if (evidence.path && fs.existsSync(evidence.path)) {
                            // Mantener extensión original
                            const ext = path.extname(evidence.filename || evidence.path) || '.jpg';
                            const destFileName = `Evidencia_${index + 1}${ext}`;
                            fs.copyFileSync(evidence.path, path.join(actFolderPath, destFileName));
                        }
                    });
                }
            });
        }

        // 5. Comprimir todo usando PowerShell Compress-Archive en Windows
        // Eliminamos el archivo zip si ya existe para evitar errores
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
        }

        // Comando PowerShell de compresión nativo y robusto
        const cmd = `powershell -Command "Compress-Archive -Path '${tempDirPath}\\*' -DestinationPath '${zipPath}' -Force"`;
        execSync(cmd, { stdio: 'inherit' });

        console.log(`✅ Archivo comprimido creado con éxito en: ${zipPath}`);
        return zipPath;

    } catch (error) {
        console.error('❌ Error al comprimir el paquete de cobro:', error.message);
        throw new Error('No se pudo generar el archivo comprimido con los soportes');
    } finally {
        // 6. Limpieza: Eliminar carpeta temporal
        try {
            if (fs.existsSync(tempDirPath)) {
                fs.rmSync(tempDirPath, { recursive: true, force: true });
            }
        } catch (cleanupError) {
            console.warn('⚠️ No se pudo eliminar la carpeta temporal:', cleanupError.message);
        }
    }
};

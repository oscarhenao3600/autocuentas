require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Contract = require('../models/Contract');
const BillingPeriod = require('../models/BillingPeriod');
const PaymentReceipt = require('../models/PaymentReceipt');
const Account = require('../models/Account');
const storageService = require('../services/storage.service');
const googleDriveService = require('../services/googleDrive.service');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27019/formatos_cuentas';

// Mime type detector
function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
        case '.pdf': return 'application/pdf';
        case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        case '.doc': return 'application/msword';
        case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        case '.xls': return 'application/vnd.ms-excel';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        case '.webp': return 'image/webp';
        case '.zip': return 'application/zip';
        default: return 'application/octet-stream';
    }
}

// Helper to resolve file locally
function findLocalFile(fileRef) {
    if (!fileRef || typeof fileRef !== 'string') return null;

    // Already on Drive
    if (storageService.extractDriveId(fileRef)) return null;

    const baseName = path.basename(fileRef);

    const candidates = [
        fileRef,
        path.resolve(__dirname, '..', fileRef),
        path.resolve(__dirname, '..', 'uploads', baseName),
        path.resolve(__dirname, '..', 'generated', baseName),
        path.resolve(__dirname, '..', 'templates', baseName)
    ];

    for (const cand of candidates) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
            return cand;
        }
    }

    return null;
}

async function migrateFile(filePathOrUrl, pathSegments, defaultFilename) {
    if (!filePathOrUrl || typeof filePathOrUrl !== 'string') return null;

    // Check if already migrated
    if (storageService.extractDriveId(filePathOrUrl)) {
        return { skipped: true, path: filePathOrUrl };
    }

    const localFile = findLocalFile(filePathOrUrl);
    if (!localFile) {
        return { notFound: true, originalPath: filePathOrUrl };
    }

    const filename = defaultFilename || path.basename(localFile);
    const mime = getMimeType(filename);
    const buffer = fs.readFileSync(localFile);

    const saved = await storageService.saveFile({
        buffer,
        filename,
        mimetype: mime,
        pathSegments
    });

    return {
        success: true,
        originalPath: filePathOrUrl,
        newPath: saved.path,
        driveId: saved.driveId,
        size: buffer.length
    };
}

async function runMigration() {
    console.log('====================================================');
    console.log('🚀 INICIANDO MIGRACIÓN DE ARCHIVOS A GOOGLE DRIVE 5TB');
    console.log('====================================================');

    console.log('📡 Conectando a MongoDB en:', MONGODB_URI.replace(/:[^:]*@/, ':***@'));
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conexión a MongoDB establecida.\n');

    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalNotFound = 0;
    let totalErrors = 0;

    // ====================================================
    // 1. MIGRAR CONTRATOS
    // ====================================================
    console.log('--- 1. Migrando Documentos de Contratos ---');
    const contracts = await Contract.find();
    console.log(`📋 Encontrados ${contracts.length} contratos para verificar.`);

    for (const contract of contracts) {
        const contractorSlug = (contract.contractorName || 'contratista').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const contractFolder = `contrato_${contract.contractNumber || contract._id}_${contractorSlug}`;
        const pathSegments = [contractFolder, 'documentos_base'];

        const contractFields = [
            'baseDocumentPath',
            'actaInicioPath',
            'rpPath',
            'rutPath',
            'bankCertificatePath',
            'securitySocialPath',
            'additionDocumentPath',
            'additionRpPath',
            'stampsPath'
        ];

        let modified = false;

        for (const field of contractFields) {
            const currentPath = contract[field];
            if (!currentPath) continue;

            try {
                const res = await migrateFile(currentPath, pathSegments);
                if (!res) continue;

                if (res.skipped) {
                    totalSkipped++;
                } else if (res.notFound) {
                    console.warn(`  ⚠️ [Contrato ${contract.contractNumber || contract._id}] Archivo no encontrado en disco: ${res.originalPath} (${field})`);
                    totalNotFound++;
                } else if (res.success) {
                    console.log(`  ✅ [Contrato ${contract.contractNumber || contract._id}] ${field}: ${res.originalPath} -> ${res.newPath} (${res.driveId})`);
                    contract[field] = res.newPath;
                    modified = true;
                    totalMigrated++;
                }
            } catch (err) {
                console.error(`  ❌ Error migrando ${field} de contrato ${contract._id}:`, err.message);
                totalErrors++;
            }
        }

        if (modified) {
            await contract.save();
            console.log(`  💾 Contrato ${contract.contractNumber || contract._id} actualizado en MongoDB.`);
        }
    }

    // ====================================================
    // 2. MIGRAR PERIODOS DE FACTURACIÓN (EVIDENCIAS, PILA, ZIP)
    // ====================================================
    console.log('\n--- 2. Migrando Periodos de Facturación y Evidencias ---');
    const periods = await BillingPeriod.find().populate('contract');
    console.log(`📅 Encontrados ${periods.length} periodos de facturación.`);

    for (const period of periods) {
        const contract = period.contract;
        const contractorSlug = contract?.contractorName
            ? contract.contractorName.toLowerCase().replace(/[^a-z0-9]/g, '_')
            : 'general';
        const contractFolder = contract
            ? `contrato_${contract.contractNumber || contract._id}_${contractorSlug}`
            : 'cuentas_sin_contrato';
        const periodFolder = `acta_${period.actNumber || '1'}`;

        let modified = false;

        // Migrar Planilla PILA (securitySocialPath)
        if (period.securitySocialPath) {
            try {
                const res = await migrateFile(period.securitySocialPath, [contractFolder, periodFolder, 'seguridad_social']);
                if (res?.success) {
                    console.log(`  ✅ [Acta ${period.actNumber}] Seguridad Social: ${res.originalPath} -> ${res.newPath}`);
                    period.securitySocialPath = res.newPath;
                    modified = true;
                    totalMigrated++;
                } else if (res?.skipped) totalSkipped++;
                else if (res?.notFound) totalNotFound++;
            } catch (err) {
                console.error(`  ❌ Error migrando seguridadSocialPath en periodo ${period._id}:`, err.message);
                totalErrors++;
            }
        }

        // Migrar Paquete ZIP (zipPath)
        if (period.zipPath) {
            try {
                const res = await migrateFile(period.zipPath, [contractFolder, periodFolder, 'paquetes_zip']);
                if (res?.success) {
                    console.log(`  ✅ [Acta ${period.actNumber}] ZIP: ${res.originalPath} -> ${res.newPath}`);
                    period.zipPath = res.newPath;
                    modified = true;
                    totalMigrated++;
                } else if (res?.skipped) totalSkipped++;
                else if (res?.notFound) totalNotFound++;
            } catch (err) {
                console.error(`  ❌ Error migrando zipPath en periodo ${period._id}:`, err.message);
                totalErrors++;
            }
        }

        // Migrar Evidencias de cada actividad
        if (period.activities && Array.isArray(period.activities)) {
            for (let i = 0; i < period.activities.length; i++) {
                const act = period.activities[i];
                if (act.evidences && Array.isArray(act.evidences)) {
                    for (let j = 0; j < act.evidences.length; j++) {
                        const ev = act.evidences[j];
                        if (ev && ev.path) {
                            try {
                                const res = await migrateFile(
                                    ev.path,
                                    [contractFolder, periodFolder, 'evidencias'],
                                    ev.filename
                                );
                                if (res?.success) {
                                    console.log(`  ✅ [Acta ${period.actNumber}] Obligación ${act.obligationCode || i + 1} Evidencia ${j + 1}: ${res.originalPath} -> ${res.newPath}`);
                                    ev.path = res.newPath;
                                    ev.driveId = res.driveId;
                                    modified = true;
                                    totalMigrated++;
                                } else if (res?.skipped) totalSkipped++;
                                else if (res?.notFound) totalNotFound++;
                            } catch (err) {
                                console.error(`  ❌ Error migrando evidencia ${ev.path}:`, err.message);
                                totalErrors++;
                            }
                        }
                    }
                }
            }
        }

        if (modified) {
            await period.save();
            console.log(`  💾 Periodo Acta N° ${period.actNumber} actualizado en MongoDB.`);
        }
    }

    // ====================================================
    // 3. MIGRAR COMPROBANTES DE PAGO
    // ====================================================
    console.log('\n--- 3. Migrando Comprobantes de Pago ---');
    const receipts = await PaymentReceipt.find();
    console.log(`💳 Encontrados ${receipts.length} comprobantes de pago.`);

    for (const receipt of receipts) {
        if (receipt.receiptFile && receipt.receiptFile.path) {
            try {
                const res = await migrateFile(
                    receipt.receiptFile.path,
                    ['comprobantes_pago'],
                    receipt.receiptFile.filename
                );
                if (res?.success) {
                    console.log(`  ✅ [Comprobante ${receipt._id}] ${res.originalPath} -> ${res.newPath}`);
                    receipt.receiptFile.path = res.newPath;
                    receipt.receiptFile.driveId = res.driveId;
                    await receipt.save();
                    totalMigrated++;
                } else if (res?.skipped) totalSkipped++;
                else if (res?.notFound) totalNotFound++;
            } catch (err) {
                console.error(`  ❌ Error migrando comprobante ${receipt._id}:`, err.message);
                totalErrors++;
            }
        }
    }

    // ====================================================
    // 4. MIGRAR CUENTAS (LEGACY)
    // ====================================================
    console.log('\n--- 4. Migrando Cuentas (Colección legacy) ---');
    const accounts = await Account.find();
    console.log(`📑 Encontradas ${accounts.length} cuentas legacy.`);

    for (const acc of accounts) {
        let modified = false;
        if (acc.generatedDocumentPath) {
            try {
                const res = await migrateFile(acc.generatedDocumentPath, ['cuentas_legacy', 'documentos']);
                if (res?.success) {
                    acc.generatedDocumentPath = res.newPath;
                    modified = true;
                    totalMigrated++;
                } else if (res?.skipped) totalSkipped++;
                else if (res?.notFound) totalNotFound++;
            } catch (err) {}
        }
        if (modified) await acc.save();
    }

    // ====================================================
    // RESUMEN FINAL
    // ====================================================
    console.log('\n====================================================');
    console.log('📊 RESUMEN DE MIGRACIÓN:');
    console.log(`   ✅ Archivos subidos y actualizados en BD: ${totalMigrated}`);
    console.log(`   ⏩ Archivos ya existentes en Drive (saltados): ${totalSkipped}`);
    console.log(`   ⚠️ Archivos no encontrados en disco local: ${totalNotFound}`);
    console.log(`   ❌ Errores: ${totalErrors}`);
    console.log('====================================================\n');

    await mongoose.disconnect();
    console.log('🔌 Conexión a MongoDB cerrada. ¡Migración completada con éxito!');
}

runMigration().catch(err => {
    console.error('💥 Error crítico durante la migración:', err);
    process.exit(1);
});

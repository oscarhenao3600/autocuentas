const fs = require('fs');
const path = require('path');
const Account = require('../models/Account');
const User = require('../models/User');
const Contract = require('../models/Contract');
const BillingPeriod = require('../models/BillingPeriod');

const TEMPLATES_DIR = path.resolve(__dirname, '..', 'templates');

function normalizeName(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function getCanonicalTemplateName(originalName) {
    const clean = normalizeName(originalName);
    const ext = path.extname(originalName).toLowerCase();

    if (clean.includes('supervisor') || clean.includes('certificado')) {
        return `FORMATO CERTIFICADO DEL SUPERVISOR${ext}`;
    }
    if (clean.includes('informe') || clean.includes('actividad')) {
        return `FORMATO INFORME DE ACTIVIDADES${ext}`;
    }
    if (clean.includes('estampilla')) {
        return `FORMATO DESCUENTO DE ESTAMPILLAS${ext}`;
    }
    if (clean.includes('retencion') || clean.includes('fuente')) {
        return `FORMATO RETENCION EN LA FUENTE${ext}`;
    }
    return originalName;
}

// GET /api/admin/users → Get all registered contractors differentiated by cédula (excludes admin)
exports.getRegisteredContractors = async (req, res) => {
    try {
        const users = await User.find({
            _id: { $ne: req.user._id },
            role: { $ne: 'admin' }
        }).select('-password').sort({ createdAt: -1 });
        const contracts = await Contract.find();
        const billingPeriods = await BillingPeriod.find();

        const contractMap = new Map();
        contracts.forEach(c => {
            if (c.user) contractMap.set(c.user.toString(), c);
        });

        const billingMap = new Map();
        billingPeriods.forEach(bp => {
            if (bp.user) {
                const uid = bp.user.toString();
                if (!billingMap.has(uid)) billingMap.set(uid, []);
                billingMap.get(uid).push(bp);
            }
        });

        const contractors = users.map(u => {
            const contract = contractMap.get(u._id.toString()) || null;
            const periods = billingMap.get(u._id.toString()) || [];

            return {
                _id: u._id,
                fullName: u.fullName,
                email: u.email,
                role: u.role,
                telegramChatId: u.telegramChatId,
                telegramLinked: Boolean(u.telegramChatId),
                cedula: contract?.idNumber || 'Sin cédula registrada',
                contractorName: contract?.contractorName || u.fullName,
                contractNumber: contract?.contractNumber || 'Sin contrato',
                contractType: contract?.contractType || 'Prestación de Servicios',
                monthlyValue: contract?.monthlyValue || '',
                totalValue: contract?.totalValue || '',
                supervisorName: contract?.supervisorName || 'No asignado',
                supervisorDependency: contract?.supervisorDependency || 'Secretaría de Planeación',
                startDate: contract?.startDate || '',
                endDate: contract?.endDate || '',
                contractorPhone: contract?.contractorPhone || '',
                contractorAddress: contract?.contractorAddress || '',
                bankName: contract?.bankName || '',
                accountNumber: contract?.accountNumber || '',
                paymentMethod: contract?.paymentMethod || '',
                cdp: contract?.cdp || '',
                rp: contract?.rp || '',
                rubro: contract?.rubro || '',
                activitiesCount: contract?.activities ? contract.activities.length : 0,
                hasContract: Boolean(contract),
                periodsTotal: periods.length,
                periodsApproved: periods.filter(p => p.status === 'approved').length,
                periodsPending: periods.filter(p => p.status === 'pending').length,
                createdAt: u.createdAt
            };
        });

        res.json(contractors);
    } catch (error) {
        console.error('Error al obtener lista de contratistas:', error);
        res.status(500).json({ message: 'Error al obtener la lista de usuarios', error: error.message });
    }
};

exports.getAllAccounts = async (req, res) => {
    try {
        const accounts = await Account.find()
            .populate('user', 'fullName email')
            .sort({ createdAt: -1 });
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener cuentas', error: error.message });
    }
};

exports.updateAccountStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const account = await Account.findById(req.params.id);

        if (!account) {
            return res.status(404).json({ message: 'Cuenta no encontrada' });
        }

        account.status = status;
        await account.save();

        res.json({ message: 'Estado actualizado correctamente', account });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar cuenta', error: error.message });
    }
};

// GET /api/admin/templates → List active templates in templates folder
exports.getTemplates = async (req, res) => {
    try {
        if (!fs.existsSync(TEMPLATES_DIR)) {
            fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
            return res.json([]);
        }

        const files = fs.readdirSync(TEMPLATES_DIR);
        const templates = files
            .filter(f => !f.startsWith('.') && !f.endsWith('.bak'))
            .map(filename => {
                const filePath = path.join(TEMPLATES_DIR, filename);
                const stats = fs.statSync(filePath);
                return {
                    name: filename,
                    size: stats.size,
                    modifiedAt: stats.mtime
                };
            });

        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: 'Error al listar plantillas', error: error.message });
    }
};

// POST /api/admin/template → Upload multiple or single templates
exports.uploadTemplate = async (req, res) => {
    try {
        const rawFiles = req.files || (req.file ? [req.file] : []);

        if (!rawFiles || rawFiles.length === 0) {
            return res.status(400).json({ message: 'Por favor selecciona al menos un archivo de plantilla' });
        }

        if (!fs.existsSync(TEMPLATES_DIR)) {
            fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
        }

        const savedFiles = [];

        for (const file of rawFiles) {
            const canonicalName = getCanonicalTemplateName(file.originalname);
            const targetPath = path.join(TEMPLATES_DIR, canonicalName);

            // Copy/Move uploaded temp file to templates directory
            fs.copyFileSync(file.path, targetPath);

            // If the original name was different from canonical name, save original as well
            if (canonicalName !== file.originalname) {
                const originalTargetPath = path.join(TEMPLATES_DIR, file.originalname);
                fs.copyFileSync(file.path, originalTargetPath);
            }

            // Remove temp uploaded file
            try {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            } catch (_) {}

            savedFiles.push({
                originalName: file.originalname,
                savedAs: canonicalName,
                size: file.size
            });
        }

        res.json({
            message: `${savedFiles.length} plantilla(s) subida(s) y guardada(s) con éxito en el servidor`,
            savedFiles
        });
    } catch (error) {
        console.error('Error al subir plantilla:', error);
        res.status(500).json({ message: 'Error al procesar plantilla(s)', error: error.message });
    }
};

// DELETE /api/admin/templates/:filename → Delete template
exports.deleteTemplate = async (req, res) => {
    try {
        const filename = path.basename(req.params.filename);
        const filePath = path.join(TEMPLATES_DIR, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Plantilla no encontrada' });
        }

        fs.unlinkSync(filePath);
        res.json({ message: `Plantilla ${filename} eliminada correctamente` });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar plantilla', error: error.message });
    }
};

// DELETE /api/admin/users/:id → Delete a contractor user and cascade delete their data
exports.deleteUser = async (req, res) => {
    try {
        const targetUserId = req.params.id;

        // Prevent self-deletion
        if (targetUserId === req.user._id.toString()) {
            return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta de administrador' });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Prevent deleting administrators
        if (targetUser.role === 'admin') {
            return res.status(403).json({ message: 'No se permite eliminar cuentas con rol de administrador' });
        }

        // 1. Delete associated Contract
        await Contract.deleteMany({ user: targetUserId });

        // 2. Delete associated Billing Periods
        await BillingPeriod.deleteMany({ user: targetUserId });

        // 3. Delete associated Accounts
        await Account.deleteMany({ user: targetUserId });

        // 4. Delete the User
        await User.findByIdAndDelete(targetUserId);

        res.json({
            message: `Usuario "${targetUser.fullName || targetUser.email}" y todos sus datos contractuales eliminados con éxito`
        });
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        res.status(500).json({ message: 'Error al eliminar el usuario', error: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// FILE RESOLVER HELPERS FOR ADMIN DOCUMENT MANAGEMENT
// ──────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
const GENERATED_DIR = path.resolve(__dirname, '..', 'generated');

function resolveSafeFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') return null;
    const cleanPath = filePath.trim();
    if (!cleanPath) return null;

    if (path.isAbsolute(cleanPath) && fs.existsSync(cleanPath)) {
        return cleanPath;
    }

    const relRoot = path.resolve(__dirname, '..', cleanPath.replace(/^[\\\/]+/, ''));
    if (fs.existsSync(relRoot)) return relRoot;

    const baseName = path.basename(cleanPath);
    const inUploads = path.join(UPLOADS_DIR, baseName);
    if (fs.existsSync(inUploads)) return inUploads;

    const inGenerated = path.join(GENERATED_DIR, baseName);
    if (fs.existsSync(inGenerated)) return inGenerated;

    return null;
}

function getFileInfo(filePath) {
    if (!filePath) return { exists: false, size: 0, mtime: null, resolvedPath: null, fileUrl: null, fileName: '' };
    const baseName = path.basename(filePath);
    const resolved = resolveSafeFilePath(filePath);
    let size = 0;
    let mtime = null;
    let exists = false;

    if (resolved && fs.existsSync(resolved)) {
        try {
            const stats = fs.statSync(resolved);
            size = stats.size;
            mtime = stats.mtime;
            exists = true;
        } catch (_) {}
    }

    // Determine public URL
    const isGenerated = filePath.includes('generated') || (resolved && resolved.includes('generated'));
    const fileUrl = isGenerated ? `/generated/${baseName}` : `/uploads/${baseName}`;

    return {
        exists,
        size,
        mtime,
        resolvedPath: resolved,
        fileUrl,
        fileName: baseName
    };
}

// ──────────────────────────────────────────────────────────────
// GET /api/admin/documents → List all documents and ZIPs across contractors
// ──────────────────────────────────────────────────────────────
exports.getAllDocuments = async (req, res) => {
    try {
        const { userId } = req.query;

        // Fetch users (exclude admins)
        const userQuery = { role: { $ne: 'admin' } };
        if (userId) userQuery._id = userId;
        const users = await User.find(userQuery).select('-password');
        const userMap = new Map();
        users.forEach(u => userMap.set(u._id.toString(), u));

        // Fetch contracts
        const contractQuery = userId ? { user: userId } : {};
        const contracts = await Contract.find(contractQuery);

        // Fetch billing periods
        const periodQuery = userId ? { user: userId } : {};
        const billingPeriods = await BillingPeriod.find(periodQuery).sort({ actNumber: 1 });

        const documents = [];

        // 1. Process Contract Documents
        const contractFieldMeta = [
            { field: 'baseDocumentPath', title: 'Minuta del Contrato (PDF)', category: 'Contrato Base', type: 'contract_doc' },
            { field: 'actaInicioPath', title: 'Acta de Inicio (PDF)', category: 'Contrato Base', type: 'contract_doc' },
            { field: 'rpPath', title: 'Registro Presupuestal RP (PDF)', category: 'Contrato Base', type: 'contract_doc' },
            { field: 'rutPath', title: 'RUT Actualizado (PDF)', category: 'Contrato Base', type: 'contract_doc' },
            { field: 'bankCertificatePath', title: 'Certificación Bancaria (PDF)', category: 'Contrato Base', type: 'contract_doc' },
            { field: 'securitySocialPath', title: 'Planilla de Seguridad Social (Base)', category: 'Seguridad Social', type: 'contract_doc' },
            { field: 'additionDocumentPath', title: 'Modificatorio de Adición (PDF)', category: 'Contrato Base', type: 'contract_doc' },
            { field: 'additionRpPath', title: 'RP de Adición (PDF)', category: 'Contrato Base', type: 'contract_doc' }
        ];

        contracts.forEach(contract => {
            const contractorUser = userMap.get(contract.user?.toString());
            // If user filtered or is an admin, skip if not in userMap
            if (!contractorUser) return;

            contractFieldMeta.forEach(meta => {
                const pathVal = contract[meta.field];
                if (pathVal && typeof pathVal === 'string' && pathVal.trim()) {
                    const info = getFileInfo(pathVal);
                    documents.push({
                        id: `contract_${contract._id}_${meta.field}`,
                        docType: meta.type,
                        category: meta.category,
                        title: meta.title,
                        fileName: info.fileName,
                        fileUrl: info.fileUrl,
                        fileSize: info.size,
                        exists: info.exists,
                        uploadedAt: info.mtime || contract.createdAt,
                        contractor: {
                            id: contractorUser._id,
                            fullName: contractorUser.fullName,
                            email: contractorUser.email,
                            cedula: contract.idNumber || 'Sin cédula',
                            contractNumber: contract.contractNumber || 'Sin contrato'
                        },
                        target: {
                            targetId: contract._id,
                            field: meta.field,
                            docType: meta.type
                        }
                    });
                }
            });
        });

        // 2. Process Billing Periods (Planillas, Evidences, ZIPs)
        billingPeriods.forEach(bp => {
            const contractorUser = userMap.get(bp.user?.toString());
            if (!contractorUser) return;

            const contract = contracts.find(c => c.user?.toString() === bp.user?.toString());
            const cedula = contract?.idNumber || 'Sin cédula';
            const contractNumber = contract?.contractNumber || 'Sin contrato';

            // 2.1 Security Social Planilla for this period
            if (bp.securitySocialPath && bp.securitySocialPath.trim()) {
                const info = getFileInfo(bp.securitySocialPath);
                documents.push({
                    id: `period_${bp._id}_ss`,
                    docType: 'period_ss',
                    category: 'Seguridad Social',
                    title: `Planilla de Seguridad Social (Acta N° ${bp.actNumber})`,
                    fileName: info.fileName,
                    fileUrl: info.fileUrl,
                    fileSize: info.size,
                    exists: info.exists,
                    uploadedAt: info.mtime || bp.createdAt,
                    periodInfo: {
                        periodId: bp._id,
                        actNumber: bp.actNumber,
                        periodFrom: bp.periodFrom,
                        periodTo: bp.periodTo,
                        status: bp.status
                    },
                    contractor: {
                        id: contractorUser._id,
                        fullName: contractorUser.fullName,
                        email: contractorUser.email,
                        cedula,
                        contractNumber
                    },
                    target: {
                        targetId: bp._id,
                        field: 'securitySocialPath',
                        docType: 'period_ss'
                    }
                });
            }

            // 2.2 ZIP Package generated
            if (bp.zipPath && bp.zipPath.trim()) {
                const info = getFileInfo(bp.zipPath);
                documents.push({
                    id: `period_${bp._id}_zip`,
                    docType: 'zip',
                    category: 'Paquete ZIP',
                    title: `Paquete ZIP Compilado (Acta N° ${bp.actNumber})`,
                    fileName: info.fileName,
                    fileUrl: info.fileUrl,
                    fileSize: info.size,
                    exists: info.exists,
                    uploadedAt: info.mtime || bp.createdAt,
                    periodInfo: {
                        periodId: bp._id,
                        actNumber: bp.actNumber,
                        periodFrom: bp.periodFrom,
                        periodTo: bp.periodTo,
                        status: bp.status
                    },
                    contractor: {
                        id: contractorUser._id,
                        fullName: contractorUser.fullName,
                        email: contractorUser.email,
                        cedula,
                        contractNumber
                    },
                    target: {
                        targetId: bp._id,
                        field: 'zipPath',
                        docType: 'zip'
                    }
                });
            }

            // 2.3 Evidences per activity
            if (bp.activities && bp.activities.length > 0) {
                bp.activities.forEach((act, actIdx) => {
                    if (act.evidences && act.evidences.length > 0) {
                        act.evidences.forEach((ev, evIdx) => {
                            if (ev.path && ev.path.trim()) {
                                const info = getFileInfo(ev.path);
                                documents.push({
                                    id: `evidence_${ev._id || `${bp._id}_${actIdx}_${evIdx}`}`,
                                    docType: 'evidence',
                                    category: 'Evidencias',
                                    title: `Evidencia Obligación ${act.obligationCode || `#${actIdx + 1}`} (Acta N° ${bp.actNumber})`,
                                    fileName: ev.filename || info.fileName,
                                    fileUrl: info.fileUrl,
                                    fileSize: info.size,
                                    exists: info.exists,
                                    uploadedAt: info.mtime || bp.createdAt,
                                    periodInfo: {
                                        periodId: bp._id,
                                        actNumber: bp.actNumber,
                                        obligationCode: act.obligationCode || `2.2.${actIdx + 1}`
                                    },
                                    contractor: {
                                        id: contractorUser._id,
                                        fullName: contractorUser.fullName,
                                        email: contractorUser.email,
                                        cedula,
                                        contractNumber
                                    },
                                    target: {
                                        targetId: bp._id,
                                        evidenceId: ev._id ? ev._id.toString() : null,
                                        evidencePath: ev.path,
                                        docType: 'evidence'
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });

        // Sort documents by uploadedAt descending
        documents.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));

        res.json(documents);
    } catch (error) {
        console.error('Error al listar documentos de contratistas:', error);
        res.status(500).json({ message: 'Error al listar documentos', error: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// DELETE /api/admin/documents → Delete a specific document and unlink from DB
// ──────────────────────────────────────────────────────────────
exports.deleteDocument = async (req, res) => {
    try {
        const { docType, targetId, field, evidenceId, evidencePath } = req.body;

        if (!docType || !targetId) {
            return res.status(400).json({ message: 'Faltan parámetros requeridos (docType, targetId)' });
        }

        let deletedFileName = '';

        if (docType === 'contract_doc') {
            const contract = await Contract.findById(targetId);
            if (!contract) return res.status(404).json({ message: 'Contrato no encontrado' });

            const filePath = contract[field];
            if (filePath) {
                deletedFileName = path.basename(filePath);
                const resolved = resolveSafeFilePath(filePath);
                if (resolved && fs.existsSync(resolved)) {
                    try { fs.unlinkSync(resolved); } catch (_) {}
                }
                contract[field] = '';
                await contract.save();
            }
        } else if (docType === 'period_ss') {
            const period = await BillingPeriod.findById(targetId);
            if (!period) return res.status(404).json({ message: 'Periodo no encontrado' });

            const filePath = period.securitySocialPath;
            if (filePath) {
                deletedFileName = path.basename(filePath);
                const resolved = resolveSafeFilePath(filePath);
                if (resolved && fs.existsSync(resolved)) {
                    try { fs.unlinkSync(resolved); } catch (_) {}
                }
                period.securitySocialPath = '';
                await period.save();
            }
        } else if (docType === 'zip') {
            const period = await BillingPeriod.findById(targetId);
            if (!period) return res.status(404).json({ message: 'Periodo no encontrado' });

            const filePath = period.zipPath;
            if (filePath) {
                deletedFileName = path.basename(filePath);
                const resolved = resolveSafeFilePath(filePath);
                if (resolved && fs.existsSync(resolved)) {
                    try { fs.unlinkSync(resolved); } catch (_) {}
                }
                period.zipPath = '';
                await period.save();
            }
        } else if (docType === 'evidence') {
            const period = await BillingPeriod.findById(targetId);
            if (!period) return res.status(404).json({ message: 'Periodo no encontrado' });

            let fileFound = null;
            if (period.activities && period.activities.length > 0) {
                period.activities.forEach(act => {
                    if (act.evidences && act.evidences.length > 0) {
                        const targetEv = act.evidences.find(e => 
                            (evidenceId && e._id && e._id.toString() === evidenceId) || 
                            (evidencePath && e.path === evidencePath)
                        );
                        if (targetEv) {
                            fileFound = targetEv.path;
                            deletedFileName = targetEv.filename || path.basename(targetEv.path);
                        }
                        act.evidences = act.evidences.filter(e => 
                            !(evidenceId && e._id && e._id.toString() === evidenceId) && 
                            !(evidencePath && e.path === evidencePath)
                        );
                    }
                });
            }

            if (fileFound) {
                const resolved = resolveSafeFilePath(fileFound);
                if (resolved && fs.existsSync(resolved)) {
                    try { fs.unlinkSync(resolved); } catch (_) {}
                }
            }
            await period.save();
        } else {
            return res.status(400).json({ message: `Tipo de documento desconocido: ${docType}` });
        }

        res.json({
            message: `Documento ${deletedFileName ? `"${deletedFileName}"` : ''} eliminado correctamente. El contratista ya puede volver a subirlo.`,
            deletedFileName
        });
    } catch (error) {
        console.error('Error al eliminar documento:', error);
        res.status(500).json({ message: 'Error al eliminar el documento', error: error.message });
    }
};

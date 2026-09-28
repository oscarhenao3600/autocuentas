const fs = require('fs');
const path = require('path');
const Account = require('../models/Account');
const User = require('../models/User');
const Contract = require('../models/Contract');
const BillingPeriod = require('../models/BillingPeriod');
const TelegramPrivilege = require('../models/TelegramPrivilege');
const PaymentConfig = require('../models/PaymentConfig');
const PaymentReceipt = require('../models/PaymentReceipt');

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
        const contracts = await Contract.find().sort({ createdAt: -1 });
        const billingPeriods = await BillingPeriod.find();

        const contractMap = new Map();
        contracts.forEach(c => {
            if (c.user) {
                const uid = c.user.toString();
                if (!contractMap.has(uid)) contractMap.set(uid, []);
                contractMap.get(uid).push(c);
            }
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
            const userContracts = contractMap.get(u._id.toString()) || [];
            const primaryContract = userContracts[0] || null;
            const periods = billingMap.get(u._id.toString()) || [];

            return {
                _id: u._id,
                fullName: u.fullName,
                email: u.email,
                role: u.role,
                telegramChatId: u.telegramChatId,
                telegramLinked: Boolean(u.telegramChatId),
                cedula: primaryContract?.idNumber || 'Sin cédula registrada',
                contractorName: primaryContract?.contractorName || u.fullName,
                contractNumber: primaryContract?.contractNumber || 'Sin contrato',
                entityName: primaryContract?.entityName || primaryContract?.supervisorDependency || 'Alcaldía de Armenia',
                contractsCount: userContracts.length,
                contracts: userContracts.map(c => ({
                    _id: c._id,
                    contractNumber: c.contractNumber,
                    entityName: c.entityName || c.supervisorDependency || 'Alcaldía',
                    supervisorDependency: c.supervisorDependency,
                    supervisorName: c.supervisorName,
                    startDate: c.startDate,
                    endDate: c.endDate,
                    totalValue: c.totalValue,
                    monthlyValue: c.monthlyValue,
                    status: c.status || 'active',
                    activitiesCount: c.activities ? c.activities.length : 0
                })),
                contractType: primaryContract?.contractType || 'Prestación de Servicios',
                monthlyValue: primaryContract?.monthlyValue || '',
                totalValue: primaryContract?.totalValue || '',
                supervisorName: primaryContract?.supervisorName || 'No asignado',
                supervisorDependency: primaryContract?.supervisorDependency || 'Secretaría de Planeación',
                startDate: primaryContract?.startDate || '',
                endDate: primaryContract?.endDate || '',
                contractorPhone: primaryContract?.contractorPhone || '',
                contractorAddress: primaryContract?.contractorAddress || '',
                bankName: primaryContract?.bankName || '',
                accountNumber: primaryContract?.accountNumber || '',
                paymentMethod: primaryContract?.paymentMethod || '',
                cdp: primaryContract?.cdp || '',
                rp: primaryContract?.rp || '',
                rubro: primaryContract?.rubro || '',
                activitiesCount: primaryContract?.activities ? primaryContract.activities.length : 0,
                hasContract: userContracts.length > 0,
                isPaymentExempt: Boolean(u.isPaymentExempt),
                exemptReason: u.exemptReason || '',
                periodsTotal: periods.length,
                periodsApproved: periods.filter(p => p.status === 'approved').length,
                periodsPending: periods.filter(p => p.status === 'pending').length,
                periodsList: periods.map(p => ({
                    _id: p._id,
                    actNumber: p.actNumber,
                    status: p.status,
                    isPaid: p.isPaid || p.actNumber === 1 || Boolean(u.isPaymentExempt),
                    paymentStatus: u.isPaymentExempt ? 'exempt' : (p.actNumber === 1 ? 'free_trial' : (p.isPaid ? 'paid' : (p.paymentStatus || 'pending_payment'))),
                    paymentDate: p.paymentDate,
                    paymentAmount: p.paymentAmount
                })),
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
            .populate('contract', 'contractNumber entityName supervisorDependency contractorName')
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

// POST /api/admin/users → Register a new contractor/official directly from admin panel
exports.createContractor = async (req, res) => {
    try {
        const {
            fullName,
            cedula,
            email,
            password,
            contractNumber,
            entityName,
            monthlyValue,
            totalValue,
            supervisorName,
            supervisorDependency,
            contractorPhone,
            contractorAddress
        } = req.body;

        if (!fullName || !String(fullName).trim()) {
            return res.status(400).json({ message: 'El nombre completo es obligatorio' });
        }
        if (!cedula || !String(cedula).trim()) {
            return res.status(400).json({ message: 'La cédula de ciudadanía es obligatoria' });
        }

        const cleanCedula = String(cedula).replace(/\D/g, '');
        const cleanEmail = email && String(email).trim() 
            ? String(email).trim().toLowerCase() 
            : `contratista.${cleanCedula}@sistema.gov.co`;

        // Check if user with email already exists
        let user = await User.findOne({ email: cleanEmail });
        if (user && user.role === 'admin') {
            return res.status(400).json({ message: 'No se puede asociar un contratista a una cuenta de administrador existente' });
        }

        const defaultPassword = password && String(password).length >= 8 
            ? password 
            : `Contratista.${cleanCedula}*`;

        if (!user) {
            user = await User.create({
                fullName: fullName.trim(),
                email: cleanEmail,
                password: defaultPassword,
                role: 'client'
            });
        }

        // Check if contract with contractNumber already exists
        const cleanContractNumber = contractNumber && String(contractNumber).trim() 
            ? String(contractNumber).trim() 
            : `CPS-${cleanCedula.slice(-4)}-2026`;

        const newContract = await Contract.create({
            user: user._id,
            idNumber: cleanCedula,
            contractorName: fullName.trim(),
            contractNumber: cleanContractNumber,
            entityName: entityName ? entityName.trim() : 'Alcaldía de Armenia',
            monthlyValue: monthlyValue ? String(monthlyValue).trim() : '',
            totalValue: totalValue ? String(totalValue).trim() : '',
            supervisorName: supervisorName ? supervisorName.trim() : 'No asignado',
            supervisorDependency: supervisorDependency ? supervisorDependency.trim() : 'Secretaría de Planeación',
            contractorPhone: contractorPhone ? String(contractorPhone).trim() : '',
            contractorAddress: contractorAddress ? String(contractorAddress).trim() : '',
            status: 'active'
        });

        res.status(201).json({
            message: `Funcionario / Contratista "${user.fullName}" (C.C. ${cleanCedula}) registrado con éxito`,
            contractor: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                cedula: cleanCedula,
                contractorName: user.fullName,
                contractNumber: newContract.contractNumber,
                entityName: newContract.entityName,
                contractsCount: 1,
                hasContract: true,
                monthlyValue: newContract.monthlyValue,
                totalValue: newContract.totalValue,
                supervisorName: newContract.supervisorName,
                supervisorDependency: newContract.supervisorDependency
            }
        });
    } catch (error) {
        console.error('Error al registrar nuevo contratista:', error);
        res.status(500).json({ message: 'Error al registrar el contratista', error: error.message });
    }
};

// PATCH /api/admin/users/:id/toggle-exempt → Toggle contractor payment exemption
exports.toggleUserExemption = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        user.isPaymentExempt = !user.isPaymentExempt;
        if (!user.isPaymentExempt) {
            user.exemptReason = '';
        } else if (req.body.exemptReason) {
            user.exemptReason = String(req.body.exemptReason).trim();
        }

        await user.save();

        res.json({
            message: `Funcionario "${user.fullName}" ahora está ${user.isPaymentExempt ? 'EXENTO de pago (Sin Costo)' : 'sujeto a cobro normal a partir de Acta 2'}`,
            isPaymentExempt: user.isPaymentExempt,
            exemptReason: user.exemptReason
        });
    } catch (error) {
        console.error('Error al cambiar exención de pago:', error);
        res.status(500).json({ message: 'Error al cambiar estado de exención', error: error.message });
    }
};

// PATCH /api/admin/periods/:id/toggle-paid → Mark specific act/period as paid/enabled
exports.togglePeriodPayment = async (req, res) => {
    try {
        const period = await BillingPeriod.findById(req.params.id);
        if (!period) return res.status(404).json({ message: 'Periodo no encontrado' });

        period.isPaid = !period.isPaid;
        period.paymentStatus = period.isPaid ? 'paid' : (period.actNumber === 1 ? 'free_trial' : 'pending_payment');
        if (period.isPaid) {
            period.paymentDate = new Date();
            if (req.body.paymentAmount) period.paymentAmount = Number(req.body.paymentAmount);
            if (req.body.paymentNotes) period.paymentNotes = String(req.body.paymentNotes).trim();
        } else {
            period.paymentDate = null;
        }

        await period.save();

        res.json({
            message: `Acta N° ${period.actNumber} marcada como ${period.isPaid ? 'PAGADA / HABILITADA' : 'PENDIENTE DE PAGO'}`,
            period
        });
    } catch (error) {
        console.error('Error al actualizar estado de pago:', error);
        res.status(500).json({ message: 'Error al actualizar estado de pago', error: error.message });
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
                            contractNumber: contract.contractNumber || 'Sin contrato',
                            entityName: contract.entityName || contract.supervisorDependency || 'Alcaldía de Armenia'
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

            const contract = bp.contract 
                ? contracts.find(c => c._id.toString() === bp.contract.toString())
                : contracts.find(c => c.user?.toString() === bp.user?.toString());
            const cedula = contract?.idNumber || 'Sin cédula';
            const contractNumber = contract?.contractNumber || 'Sin contrato';
            const entityName = contract?.entityName || contract?.supervisorDependency || 'Alcaldía de Armenia';

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
                        contractNumber,
                        entityName
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
                        contractNumber,
                        entityName
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
                                        contractNumber,
                                        entityName
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

// ──────────────────────────────────────────────────────────────
// TELEGRAM PRIVILEGES MANAGEMENT (OPERADORES MULTICUENTA)
// ──────────────────────────────────────────────────────────────

// GET /api/admin/telegram-privileges
exports.getTelegramPrivileges = async (req, res) => {
    try {
        const privileges = await TelegramPrivilege.find()
            .populate('assignedUsers', 'fullName email role')
            .populate('createdBy', 'fullName email')
            .sort({ createdAt: -1 });

        // Enrich assignedUsers with contract info (cédula, contractNumber, entityName)
        const allContracts = await Contract.find().select('user idNumber contractNumber entityName');
        const contractMap = new Map();
        allContracts.forEach(c => {
            if (c.user) contractMap.set(c.user.toString(), c);
        });

        const formatted = privileges.map(p => {
            const enrichedAssigned = (p.assignedUsers || []).map(u => {
                const c = contractMap.get(u._id.toString());
                return {
                    _id: u._id,
                    fullName: u.fullName,
                    email: u.email,
                    cedula: c?.idNumber || 'Sin cédula',
                    contractNumber: c?.contractNumber || 'En trámite',
                    entityName: c?.entityName || 'Alcaldía'
                };
            });

            return {
                _id: p._id,
                telegramChatId: p.telegramChatId,
                label: p.label,
                description: p.description,
                scope: p.scope,
                operatorType: p.operatorType || 'standard',
                monthlyAccountsLimit: p.monthlyAccountsLimit || 15,
                accountsUsedThisMonth: p.accountsUsedThisMonth || 0,
                currentMonthCycle: p.currentMonthCycle,
                preferentialRate: p.preferentialRate || 20000,
                assignedUsers: enrichedAssigned,
                canRegisterFuncionarios: p.canRegisterFuncionarios,
                isActive: p.isActive,
                createdBy: p.createdBy ? { fullName: p.createdBy.fullName, email: p.createdBy.email } : null,
                lastActiveAt: p.lastActiveAt,
                createdAt: p.createdAt
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('Error al obtener privilegios de Telegram:', error);
        res.status(500).json({ message: 'Error al obtener privilegios de Telegram', error: error.message });
    }
};

// POST /api/admin/telegram-privileges
exports.createTelegramPrivilege = async (req, res) => {
    try {
        let {
            telegramChatId,
            label,
            description,
            scope,
            assignedUsers,
            operatorType,
            monthlyAccountsLimit,
            preferentialRate,
            canRegisterFuncionarios,
            isActive
        } = req.body;

        if (!telegramChatId || !String(telegramChatId).trim()) {
            return res.status(400).json({ message: 'El ID de Telegram es obligatorio' });
        }
        if (!label || !String(label).trim()) {
            return res.status(400).json({ message: 'El nombre o alias del operador es obligatorio' });
        }

        const cleanChatId = String(telegramChatId).trim();

        // Check if chatId already registered
        const existing = await TelegramPrivilege.findOne({ telegramChatId: cleanChatId });
        if (existing) {
            return res.status(400).json({ message: `El ID de Telegram "${cleanChatId}" ya tiene privilegios registrados con el nombre "${existing.label}". Puedes editarlo en lugar de crearlo de nuevo.` });
        }

        const privilege = await TelegramPrivilege.create({
            telegramChatId: cleanChatId,
            label: label.trim(),
            description: (description || '').trim(),
            scope: scope === 'specific' ? 'specific' : 'all',
            operatorType: ['exempt', 'provider', 'standard'].includes(operatorType) ? operatorType : 'standard',
            monthlyAccountsLimit: Number(monthlyAccountsLimit) > 0 ? Number(monthlyAccountsLimit) : 15,
            preferentialRate: Number(preferentialRate) >= 0 ? Number(preferentialRate) : 20000,
            assignedUsers: scope === 'specific' && Array.isArray(assignedUsers) ? assignedUsers : [],
            canRegisterFuncionarios: typeof canRegisterFuncionarios === 'boolean' ? canRegisterFuncionarios : true,
            isActive: typeof isActive === 'boolean' ? isActive : true,
            createdBy: req.user._id
        });

        res.status(201).json({
            message: `Privilegio de Telegram asignado con éxito a "${privilege.label}" (${privilege.telegramChatId})`,
            privilege
        });
    } catch (error) {
        console.error('Error al crear privilegio de Telegram:', error);
        res.status(500).json({ message: 'Error al guardar privilegio de Telegram', error: error.message });
    }
};

// PUT /api/admin/telegram-privileges/:id
exports.updateTelegramPrivilege = async (req, res) => {
    try {
        const {
            label,
            description,
            scope,
            assignedUsers,
            operatorType,
            monthlyAccountsLimit,
            preferentialRate,
            canRegisterFuncionarios,
            isActive,
            telegramChatId,
            resetMonthlyUsage
        } = req.body;
        const privilege = await TelegramPrivilege.findById(req.params.id);

        if (!privilege) {
            return res.status(404).json({ message: 'Registro de privilegio no encontrado' });
        }

        if (telegramChatId && String(telegramChatId).trim() !== privilege.telegramChatId) {
            const cleanChatId = String(telegramChatId).trim();
            const duplicate = await TelegramPrivilege.findOne({ telegramChatId: cleanChatId, _id: { $ne: privilege._id } });
            if (duplicate) {
                return res.status(400).json({ message: `El ID de Telegram "${cleanChatId}" ya pertenece a otro registro (${duplicate.label})` });
            }
            privilege.telegramChatId = cleanChatId;
        }

        if (label) privilege.label = label.trim();
        if (typeof description === 'string') privilege.description = description.trim();
        if (scope) privilege.scope = scope;
        if (scope === 'specific') {
            privilege.assignedUsers = Array.isArray(assignedUsers) ? assignedUsers : [];
        } else if (scope === 'all') {
            privilege.assignedUsers = [];
        }
        if (operatorType && ['exempt', 'provider', 'standard'].includes(operatorType)) {
            privilege.operatorType = operatorType;
        }
        if (Number(monthlyAccountsLimit) > 0) {
            privilege.monthlyAccountsLimit = Number(monthlyAccountsLimit);
        }
        if (Number(preferentialRate) >= 0) {
            privilege.preferentialRate = Number(preferentialRate);
        }
        if (resetMonthlyUsage) {
            privilege.accountsUsedThisMonth = 0;
        }
        if (typeof canRegisterFuncionarios === 'boolean') privilege.canRegisterFuncionarios = canRegisterFuncionarios;
        if (typeof isActive === 'boolean') privilege.isActive = isActive;

        await privilege.save();

        res.json({
            message: `Privilegios de "${privilege.label}" actualizados correctamente`,
            privilege
        });
    } catch (error) {
        console.error('Error al actualizar privilegio de Telegram:', error);
        res.status(500).json({ message: 'Error al actualizar privilegio', error: error.message });
    }
};

// PATCH /api/admin/telegram-privileges/:id/toggle
exports.toggleTelegramPrivilege = async (req, res) => {
    try {
        const privilege = await TelegramPrivilege.findById(req.params.id);
        if (!privilege) {
            return res.status(404).json({ message: 'Privilegio no encontrado' });
        }

        privilege.isActive = !privilege.isActive;
        await privilege.save();

        res.json({
            message: `Estado de "${privilege.label}" cambiado a ${privilege.isActive ? 'ACTIVO' : 'INACTIVO'}`,
            isActive: privilege.isActive
        });
    } catch (error) {
        console.error('Error al cambiar estado de privilegio:', error);
        res.status(500).json({ message: 'Error al cambiar estado', error: error.message });
    }
};

// DELETE /api/admin/telegram-privileges/:id
exports.deleteTelegramPrivilege = async (req, res) => {
    try {
        const privilege = await TelegramPrivilege.findByIdAndDelete(req.params.id);
        if (!privilege) {
            return res.status(404).json({ message: 'Privilegio no encontrado' });
        }

        res.json({
            message: `Privilegio de Telegram para "${privilege.label}" (${privilege.telegramChatId}) eliminado exitosamente`
        });
    } catch (error) {
        console.error('Error al eliminar privilegio:', error);
        res.status(500).json({ message: 'Error al eliminar privilegio', error: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// PAYMENT CONFIGURATION & PAYMENT RECEIPT MANAGEMENT
// ──────────────────────────────────────────────────────────────

// GET /api/admin/payment-config
exports.getPaymentConfig = async (req, res) => {
    try {
        const config = await PaymentConfig.getConfig();
        res.json(config);
    } catch (error) {
        console.error('Error al obtener configuración de pagos:', error);
        res.status(500).json({ message: 'Error al obtener configuración de pagos', error: error.message });
    }
};

// PUT /api/admin/payment-config
exports.updatePaymentConfig = async (req, res) => {
    try {
        const {
            approvalTelegramChatId,
            approvalTelegramChatIds,
            contractorRate,
            packageRate,
            packageAccountsCount,
            packageUnitRate,
            paymentInstructions
        } = req.body;

        const config = await PaymentConfig.getConfig();

        if (approvalTelegramChatId !== undefined) {
            config.approvalTelegramChatId = String(approvalTelegramChatId).trim();
        }
        if (Array.isArray(approvalTelegramChatIds)) {
            config.approvalTelegramChatIds = approvalTelegramChatIds.map(id => String(id).trim()).filter(Boolean);
        }
        if (contractorRate !== undefined && Number(contractorRate) >= 0) {
            config.contractorRate = Number(contractorRate);
        }
        if (packageRate !== undefined && Number(packageRate) >= 0) {
            config.packageRate = Number(packageRate);
        }
        if (packageAccountsCount !== undefined && Number(packageAccountsCount) > 0) {
            config.packageAccountsCount = Number(packageAccountsCount);
        }
        if (packageUnitRate !== undefined && Number(packageUnitRate) >= 0) {
            config.packageUnitRate = Number(packageUnitRate);
        }
        if (paymentInstructions && typeof paymentInstructions === 'object') {
            config.paymentInstructions = {
                ...config.paymentInstructions,
                ...paymentInstructions
            };
        }

        config.updatedBy = req.user._id;
        config.updatedAt = new Date();
        await config.save();

        res.json({
            message: 'Configuración de pagos y aprobaciones actualizada con éxito',
            config
        });
    } catch (error) {
        console.error('Error al actualizar configuración de pagos:', error);
        res.status(500).json({ message: 'Error al actualizar configuración de pagos', error: error.message });
    }
};

// GET /api/admin/payments
exports.getAllPayments = async (req, res) => {
    try {
        const payments = await PaymentReceipt.find()
            .populate('user', 'fullName email')
            .populate('contract', 'contractNumber contractorName entityName')
            .populate('billingPeriod', 'actNumber periodFrom periodTo isPaid paymentStatus')
            .sort({ createdAt: -1 });

        res.json(payments);
    } catch (error) {
        console.error('Error al listar comprobantes de pago:', error);
        res.status(500).json({ message: 'Error al listar comprobantes de pago', error: error.message });
    }
};

// PATCH /api/admin/payments/:id/approve
exports.approvePaymentAdmin = async (req, res) => {
    try {
        const payment = await PaymentReceipt.findById(req.params.id)
            .populate('user')
            .populate('contract')
            .populate('billingPeriod');

        if (!payment) {
            return res.status(404).json({ message: 'Comprobante de pago no encontrado' });
        }

        if (payment.status === 'approved') {
            return res.status(400).json({ message: 'Este pago ya fue aprobado previamente' });
        }

        payment.status = 'approved';
        payment.approvedAt = new Date();
        payment.approvedBy = req.user.fullName || req.user.email;
        payment.rejectionReason = '';
        await payment.save();

        let periodUpdated = null;

        // If individual account payment
        if (payment.paymentType === 'individual') {
            let period = payment.billingPeriod;
            if (!period && payment.user) {
                const query = { user: payment.user._id, actNumber: payment.actNumber };
                if (payment.contract) query.contract = payment.contract._id;
                period = await BillingPeriod.findOne(query);
            }

            if (period) {
                period.isPaid = true;
                period.paymentStatus = 'paid';
                period.paymentDate = new Date();
                period.paymentAmount = payment.amount || 60000;
                period.receipt = payment._id;
                await period.save();
                periodUpdated = period;
            }
        } else if (payment.paymentType === 'package') {
            const quotaToAdd = payment.packageAccountsCount || 5;
            if (payment.user) {
                const user = await User.findById(payment.user._id || payment.user);
                if (user) {
                    user.packageQuota = (user.packageQuota || 0) + quotaToAdd;
                    user.pricingPlan = 'package';
                    await user.save();
                }
            }
            if (payment.telegramChatId) {
                const privilege = await TelegramPrivilege.findOne({ telegramChatId: payment.telegramChatId });
                if (privilege) {
                    privilege.packageQuota = (privilege.packageQuota || 0) + quotaToAdd;
                    await privilege.save();
                }
            }
        }

        // Notify user via Telegram
        if (payment.telegramChatId) {
            try {
                const { sendTelegramKeyboardMessage, sendTelegramMessage } = require('../services/telegram.service');
                const contractorName = payment.contractorName || payment.user?.fullName || 'Contratista';
                if (payment.paymentType === 'package') {
                    let msg = `🎉 ¡PAGO DE PAQUETE APROBADO CON ÉXITO!\n\n`;
                    msg += `Estimado(a) ${contractorName}, le confirmamos que su pago de $ ${Number(payment.amount || 100000).toLocaleString('es-CO')} COP por el Paquete de 5 Cuentas de Cobro ha sido verificado y aprobado por la Administración.\n\n`;
                    msg += `📦 Cuentas asignadas a su cupo: 5 cuentas.\n`;
                    msg += `Ya puede iniciar la creación de cuentas y cargue de evidencias sin restricciones.`;
                    await sendTelegramMessage(payment.telegramChatId, msg);
                } else {
                    const actNum = payment.actNumber || 2;
                    let msg = `🎉 ¡PAGO APROBADO CON ÉXITO!\n\n`;
                    msg += `Estimado(a) ${contractorName}, le confirmamos que su pago de $ ${Number(payment.amount || 60000).toLocaleString('es-CO')} COP para su Acta N° ${actNum} ha sido verificado y aprobado por la Administración.\n\n`;
                    msg += `✅ El sistema ha habilitado el cargue de evidencias e información para su cuenta de cobro.\n\n`;
                    msg += `Presione el botón abajo para comenzar a cargar evidencias:`;
                    await sendTelegramKeyboardMessage(payment.telegramChatId, msg, [
                        [{ text: `📂 Subir Evidencias (Acta ${actNum})`, callback_data: `select_act_${actNum}` }],
                        [{ text: '🏥 Subir Planilla SS', callback_data: 'quick_upload_planilla' }]
                    ]);
                }
            } catch (tgErr) {
                console.error('Error al notificar al contratista por Telegram:', tgErr.message);
            }
        }

        res.json({
            message: `Pago de ${payment.contractorName || 'usuario'} por $ ${Number(payment.amount).toLocaleString('es-CO')} aprobado exitosamente`,
            payment,
            period: periodUpdated
        });
    } catch (error) {
        console.error('Error al aprobar pago:', error);
        res.status(500).json({ message: 'Error al aprobar pago', error: error.message });
    }
};

// PATCH /api/admin/payments/:id/reject
exports.rejectPaymentAdmin = async (req, res) => {
    try {
        const { reason } = req.body;
        const payment = await PaymentReceipt.findById(req.params.id)
            .populate('user')
            .populate('contract');

        if (!payment) {
            return res.status(404).json({ message: 'Comprobante de pago no encontrado' });
        }

        payment.status = 'rejected';
        payment.rejectionReason = reason || 'Comprobante no válido o valor no acreditado';
        await payment.save();

        // Notify user via Telegram
        if (payment.telegramChatId) {
            try {
                const { sendTelegramKeyboardMessage } = require('../services/telegram.service');
                const contractorName = payment.contractorName || payment.user?.fullName || 'Contratista';
                let msg = `⚠️ NOVEDAD CON SU COMPROBANTE DE PAGO\n\n`;
                msg += `Estimado(a) ${contractorName}, la administración ha revisado el comprobante de pago enviado y no fue posible validarlo.\n\n`;
                if (reason) {
                    msg += `Motivo: ${reason}\n\n`;
                }
                msg += `Por favor verifique la transferencia y envíe un nuevo comprobante legible con el valor correspondiente ($ ${Number(payment.amount).toLocaleString('es-CO')} COP), o comuníquese con el Administrador.`;
                await sendTelegramKeyboardMessage(payment.telegramChatId, msg, [
                    [{ text: '📷 Enviar Nuevo Comprobante', callback_data: payment.paymentType === 'package' ? 'pay_package' : `pay_act_${payment.actNumber || 2}` }]
                ]);
            } catch (tgErr) {
                console.error('Error al notificar rechazo de pago por Telegram:', tgErr.message);
            }
        }

        res.json({
            message: 'Pago marcado como rechazado',
            payment
        });
    } catch (error) {
        console.error('Error al rechazar pago:', error);
        res.status(500).json({ message: 'Error al rechazar pago', error: error.message });
    }
};



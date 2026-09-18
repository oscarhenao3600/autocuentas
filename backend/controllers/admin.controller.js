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

// GET /api/admin/users → Get all registered contractors differentiated by cédula
exports.getRegisteredContractors = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
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

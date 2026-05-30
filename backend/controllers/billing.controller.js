const path = require('path');
const fs   = require('fs');
const BillingPeriod   = require('../models/BillingPeriod');
const Contract        = require('../models/Contract');
const User            = require('../models/User');
const { generateDocument } = require('../services/document.service');
const { createBillingZip } = require('../services/archive.service');

// ──────────────────────────────────────────────────────────────
// Helper: Calculate IBC (Ingreso Base de Cotización)
// Rules for independientes: 40% of monthly fee, minimum 1 SMMLV.
// SMMLV 2025: $1,423,500 COP  (update each year in .env or here)
// ──────────────────────────────────────────────────────────────
const SMMLV = parseInt(process.env.SMMLV || '1423500', 10);

function calcIbc(monthlyValue) {
    const mv = parseFloat(monthlyValue) || 0;
    const forty = Math.round(mv * 0.4);
    return Math.max(forty, SMMLV);
}

// ──────────────────────────────────────────────────────────────
// Helper: Format a date in Spanish for the Word documents
// ──────────────────────────────────────────────────────────────
const MONTHS_ES = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre'
];
function formatDateEs(date) {
    const d = new Date(date);
    return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}
function monthYearEs(date) {
    const d = new Date(date);
    return { mes: MONTHS_ES[d.getMonth()].toUpperCase(), anio: d.getFullYear().toString() };
}

// ──────────────────────────────────────────────────────────────
// GET /api/billing  →  List all billing periods for the logged user
// ──────────────────────────────────────────────────────────────
exports.listMyBillingPeriods = async (req, res) => {
    try {
        const periods = await BillingPeriod
            .find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .select('-activities.evidences'); // skip heavy nested paths in list
        res.json(periods);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener periodos de cobro', error: err.message });
    }
};

// ──────────────────────────────────────────────────────────────
// GET /api/billing/:id  →  Get single billing period with full details
// ──────────────────────────────────────────────────────────────
exports.getBillingPeriod = async (req, res) => {
    try {
        const period = await BillingPeriod.findOne({ _id: req.params.id, user: req.user._id });
        if (!period) return res.status(404).json({ message: 'Periodo no encontrado' });
        res.json(period);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener el periodo', error: err.message });
    }
};

// ──────────────────────────────────────────────────────────────
// POST /api/billing  →  Create or update draft billing period
// Body: { periodFrom, periodTo, actNumber, activities: [{obligationCode, obligationText, comment}], securitySocial }
// ──────────────────────────────────────────────────────────────
exports.saveBillingPeriod = async (req, res) => {
    try {
        const { periodFrom, periodTo, actNumber, activities, securitySocial } = req.body;

        // Parse activities array (may arrive as JSON string from multipart)
        let parsedActivities = activities;
        if (typeof activities === 'string') {
            try { parsedActivities = JSON.parse(activities); } catch (_) { parsedActivities = []; }
        }

        // Handle uploaded evidences grouped by activity index
        // Multer stores them as req.files['evidence_0'], req.files['evidence_1'], etc.
        if (req.files) {
            Object.keys(req.files).forEach(fieldKey => {
                const match = fieldKey.match(/^evidence_(\d+)$/);
                if (match) {
                    const idx = parseInt(match[1], 10);
                    if (parsedActivities[idx]) {
                        if (!parsedActivities[idx].evidences) parsedActivities[idx].evidences = [];
                        req.files[fieldKey].forEach(f => {
                            parsedActivities[idx].evidences.push({
                                filename: f.originalname,
                                path: f.path,
                                mimetype: f.mimetype
                            });
                        });
                    }
                }
            });
        }

        // Parse securitySocial if JSON string
        let parsedSS = securitySocial;
        if (typeof securitySocial === 'string') {
            try { parsedSS = JSON.parse(securitySocial); } catch (_) { parsedSS = {}; }
        }

        // Upsert: one draft per actNumber per user (status pending)
        let period = await BillingPeriod.findOne({
            user: req.user._id,
            actNumber: parseInt(actNumber) || 1,
            status: 'pending'
        });

        if (period) {
            period.periodFrom    = periodFrom   || period.periodFrom;
            period.periodTo      = periodTo     || period.periodTo;
            period.activities    = parsedActivities || period.activities;
            period.securitySocial = parsedSS    || period.securitySocial;
            await period.save();
        } else {
            period = await BillingPeriod.create({
                user:           req.user._id,
                actNumber:      parseInt(actNumber) || 1,
                periodFrom,
                periodTo,
                activities:     parsedActivities || [],
                securitySocial: parsedSS || {}
            });
        }

        res.json({ message: 'Borrador guardado correctamente', data: period });
    } catch (err) {
        console.error('Error saveBillingPeriod:', err);
        res.status(500).json({ message: 'Error al guardar el periodo', error: err.message });
    }
};

// ──────────────────────────────────────────────────────────────
// POST /api/billing/:id/generate  →  Generate all 4 Word docs + ZIP
// ──────────────────────────────────────────────────────────────
exports.generatePackage = async (req, res) => {
    try {
        const period = await BillingPeriod.findOne({ _id: req.params.id, user: req.user._id });
        if (!period) return res.status(404).json({ message: 'Periodo no encontrado' });

        const contract = await Contract.findOne({ user: req.user._id });
        if (!contract) return res.status(400).json({ message: 'Debe configurar su contrato antes de generar el paquete' });

        const user = await User.findById(req.user._id).select('-password');

        // ── Compute IBC ──────────────────────────────────────────
        const ibc = calcIbc(contract.monthlyValue);
        contract.ibcValue = ibc;
        await contract.save();

        // ── Determine Addition logic ──────────────────────────────
        // If the contract has an addition, we apply addition formatting from the last month of the initial contract onwards
        const periodIsAddition = contract.hasAddition && (period.actNumber >= (contract.initialDurationMonths || 4));
        
        const rawTotalVal = parseFloat(contract.totalValue) || 0;
        const rawAddVal = parseFloat(contract.additionValue) || 0;
        const combinedTotalVal = rawTotalVal + rawAddVal;
        
        let combinedValWord = contract.totalValueWord || '';
        if (contract.hasAddition && contract.additionValueWord) {
            combinedValWord = `${contract.totalValueWord} MÁS ADICIÓN DE ${contract.additionValueWord}`;
        }

        // ── Build common data object for all 4 templates ─────────
        const { mes, anio } = monthYearEs(period.periodTo);
        const commonData = {
            // Contractor info
            contractorName:   contract.contractorName    || '',
            idNumber:         contract.idNumber           || '',
            contractNumber:   contract.contractNumber     || '',
            contractType:     contract.contractType       || '',
            contractObject:   contract.contractObject     || '',
            supervisorName:   contract.supervisorName     || '',
            startDate:        contract.startDate          || '',
            endDate:          contract.endDate            || '',
            // Financial
            totalValue:       Number(contract.totalValue  || 0).toLocaleString('es-CO'),
            totalValueWord:   contract.totalValueWord     || '',
            monthlyValue:     Number(contract.monthlyValue|| 0).toLocaleString('es-CO'),
            monthlyValueWord: contract.monthlyValueWord   || '',
            ibcValue:         ibc.toLocaleString('es-CO'),
            // Document identifiers
            rpNumber:         contract.rp                 || '',
            cdpNumber:        contract.cdp                || '',
            rubro:            contract.rubro              || '',
            actNumber:        period.actNumber.toString(),
            // Period
            periodFrom:       formatDateEs(period.periodFrom),
            periodTo:         formatDateEs(period.periodTo),
            mes,
            anio,
            // Addition details
            hasAddition:       periodIsAddition,
            additionValue:     rawAddVal.toLocaleString('es-CO'),
            additionValueWord: contract.additionValueWord || '',
            additionStartDate: contract.additionStartDate ? formatDateEs(contract.additionStartDate) : '',
            additionEndDate:   contract.additionEndDate ? formatDateEs(contract.additionEndDate) : '',
            additionCdp:       contract.additionCdp || '',
            additionRp:        contract.additionRp || '',
            additionRubro:     contract.additionRubro || '',
            additionDuration:  contract.additionDuration || '',
            totalValueWithAddition: combinedTotalVal.toLocaleString('es-CO'),
            totalValueWithAdditionWord: combinedValWord,
            // Security Social
            ssOperator:       period.securitySocial?.operator      || '',
            ssPlanilla:       period.securitySocial?.planillaNumber || '',
            ssTotalPaid:      Number(period.securitySocial?.totalPaid   || 0).toLocaleString('es-CO'),
            ssSalud:          Number(period.securitySocial?.saludPaid   || 0).toLocaleString('es-CO'),
            ssPension:        Number(period.securitySocial?.pensionPaid || 0).toLocaleString('es-CO'),
            ssArl:            Number(period.securitySocial?.arlPaid     || 0).toLocaleString('es-CO'),
            ssPeriod:         period.securitySocial?.period || mes,
            // Activities array (for loops in templates)
            activities: (period.activities || []).map((act, i) => ({
                num:             (i + 1).toString(),
                obligationCode:  act.obligationCode || '',
                obligationText:  act.obligationText || '',
                comment:         act.comment        || ''
            }))
        };


        // ── Generate 4 Word documents ─────────────────────────────
        const templates = [
            { name: 'FORMATO CERTIFICADO DEL SUPERVISOR.docx',  key: 'certificadoPath' },
            { name: 'FORMATO INFORME DE ACTIVIDADES.docx',      key: 'informePath' },
            { name: 'FORMATO DESCUENTO DE ESTAMPILLAS.docx',    key: 'estampillasPath' },
            { name: 'FORMATO RETENCION EN LA FUENTE.docx',      key: 'retencionPath' }
        ];

        const generatedPaths = {};
        for (const tpl of templates) {
            try {
                const result = await generateDocument(tpl.name, commonData);
                generatedPaths[tpl.key] = result.outputPath;
                console.log(`✅ Generado: ${tpl.name}`);
            } catch (genErr) {
                console.warn(`⚠️ No se pudo generar ${tpl.name}: ${genErr.message}`);
            }
        }

        // Attach generated paths to period so archive.service can find them
        Object.assign(period, generatedPaths);

        // ── Create ZIP ────────────────────────────────────────────
        const zipPath = await createBillingZip(period, contract, user);
        period.zipPath = zipPath;
        period.status  = 'pending'; // ready but not yet approved
        await period.save();

        res.json({
            message: 'Paquete generado con éxito',
            zipUrl: `/generated/${path.basename(zipPath)}`,
            data: period
        });

    } catch (err) {
        console.error('Error generatePackage:', err);
        res.status(500).json({ message: 'Error al generar el paquete', error: err.message });
    }
};

// ──────────────────────────────────────────────────────────────
// GET /api/billing/:id/download  →  Stream the ZIP to the browser
// ──────────────────────────────────────────────────────────────
exports.downloadPackage = async (req, res) => {
    try {
        const period = await BillingPeriod.findOne({ _id: req.params.id, user: req.user._id });
        if (!period) return res.status(404).json({ message: 'Periodo no encontrado' });
        if (!period.zipPath || !fs.existsSync(period.zipPath)) {
            return res.status(404).json({ message: 'El paquete ZIP aún no ha sido generado. Por favor ejecute /generate primero.' });
        }

        const fileName = path.basename(period.zipPath);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/zip');
        fs.createReadStream(period.zipPath).pipe(res);
    } catch (err) {
        res.status(500).json({ message: 'Error al descargar el paquete', error: err.message });
    }
};

// ──────────────────────────────────────────────────────────────
// GET /api/billing/telegram-code  →  Generate a 6-digit Telegram linking code
// ──────────────────────────────────────────────────────────────
exports.getTelegramCode = async (req, res) => {
    try {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await User.findByIdAndUpdate(req.user._id, { telegramVerificationCode: code });
        res.json({
            message: 'Código generado. Envíalo al bot de Telegram con el comando /start <código>',
            code
        });
    } catch (err) {
        res.status(500).json({ message: 'Error al generar el código', error: err.message });
    }
};

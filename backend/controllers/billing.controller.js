const path = require('path');
const fs   = require('fs');
const BillingPeriod   = require('../models/BillingPeriod');
const Contract        = require('../models/Contract');
const User            = require('../models/User');
const { generateDocument } = require('../services/document.service');
const { createBillingZip } = require('../services/archive.service');
const { extractSecuritySocialData, improveEvidenceText, generateObligationAnnexDescription, generateExecutionEvidencesSummary } = require('../services/gemini.service');
const annexService = require('../services/annex.service');
const storageService = require('../services/storage.service');
const nextcloudService = require('../services/nextcloud.service');
const { calculateSocialSecurity, formatRubroPresupuestal } = require('../utils/period.utils');
const { getFormatNameForDependency } = require('../utils/secretariasDictionary');

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
function parseDateSafe(dateInput) {
    if (!dateInput) return null;
    if (typeof dateInput === 'string') {
        const clean = dateInput.trim();
        const datePart = clean.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            const [y, m, d] = datePart.split('-').map(Number);
            return new Date(y, m - 1, d);
        }
    } else if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
        return dateInput;
    }
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
}

function formatDateEs(dateInput) {
    const d = parseDateSafe(dateInput);
    if (!d) return '';
    const m = MONTHS_ES[d.getMonth()];
    const capMonth = m.charAt(0).toUpperCase() + m.slice(1);
    return `${d.getDate()} de ${capMonth} de ${d.getFullYear()}`;
}

function formatDateNumeric(dateInput) {
    const d = parseDateSafe(dateInput);
    if (!d) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day} - ${month} - ${year}`;
}

function monthYearEs(dateInput) {
    const d = parseDateSafe(dateInput) || new Date();
    return { mes: MONTHS_ES[d.getMonth()].toUpperCase(), anio: d.getFullYear().toString() };
}

function formatActivitiesText(acts) {
    if (!acts || acts.length === 0) return 'No se registraron actividades en el periodo.';
    return acts.map((act, i) => {
        const rawCode = (act.obligationCode || `2.2.${i + 1}`).trim();
        const cleanCode = rawCode.replace(/\.+$/, '');
        const lastNumMatch = cleanCode.match(/\d+$/);
        const actNum = lastNumMatch ? lastNumMatch[0] : (i + 1).toString();

        let cleanOblText = (act.obligationText || '').trim();
        cleanOblText = cleanOblText.replace(/^obligaci[oó]n\s*[\d.]*:?\s*/i, '').trim();
        const codePattern = cleanCode.replace(/\./g, '\\.');
        cleanOblText = cleanOblText.replace(new RegExp(`^${codePattern}\\.?\\s*`, 'i'), '').trim();
        cleanOblText = cleanOblText.replace(/^[\d.]+\.?\s*/, '').trim();

        const encabezado = `${cleanCode}. ${cleanOblText}`;

        let comment = (act.comment && act.comment.trim().length > 0)
            ? act.comment.trim()
            : 'Actividades ejecutadas a satisfacción durante el periodo reportado.';

        // Quitar numeración previa si el contratista ya la escribió (ej: "5 " o "5. ")
        comment = comment.replace(new RegExp(`^${actNum}[.\\s-]+\\s*`, 'i'), '').trim();
        comment = comment.replace(/^\d+[.\s-]+\s*/, '').trim();

        // Validar si ya contiene la referencia a la carpeta y anexo
        const hasAnnexRef = /carpeta\s*[\d.]*\s*anexo\s*[\d.]*/i.test(comment);
        if (!hasAnnexRef) {
            if (!comment.endsWith('.')) {
                comment += '.';
            }
            comment += ` carpeta${cleanCode} Anexo ${actNum}.1.`;
        }

        return `${encabezado}\n${actNum} ${comment}`;
    }).join('\n\n');
}

function isImageEvidence(ev) {
    if (!ev) return false;
    const mime = (ev.mimetype || '').toLowerCase();
    const ext = path.extname(ev.filename || ev.path || '').toLowerCase();
    return mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp'].includes(ext);
}

function formatEvidencesText(acts) {
    if (!acts || acts.length === 0) return 'Archivos de soporte digital anexos en el paquete de cobro.';
    return acts.map((act, i) => {
        const code = act.obligationCode || `2.2.${i + 1}`;
        if (!act.evidences || act.evidences.length === 0) {
            return `Obligación ${code}: Ver documento "Anexo Descripcion ${code}.docx" en carpeta "${code}/"`;
        }

        const photos = act.evidences.filter(isImageEvidence);
        const docs = act.evidences.filter(ev => !isImageEvidence(ev));

        const parts = [];
        parts.push(`Documento "Anexo Descripcion ${code}.docx" (carpeta "${code}/")`);

        if (photos.length > 0) {
            if (photos.length === 1) {
                parts.push(`Registro fotográfico (1 foto)`);
            } else {
                parts.push(`Registro fotográfico (${photos.length} fotos)`);
            }
        }
        if (docs.length > 0) {
            const docNames = docs.map(d => d.filename || path.basename(d.path || 'Documento')).join(', ');
            parts.push(`Soportes documentales / Excel: ${docNames}`);
        }

        return `Obligación ${code}: ${parts.join(' | ')}`;
    }).join('\n');
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

        // Resolve user and contract for Drive folder naming
        const contractId = req.body.contractId;
        const user = await User.findById(req.user._id);
        const contract = contractId ? await Contract.findById(contractId) : await Contract.findOne({ user: req.user._id }).sort({ createdAt: -1 });
        const contractorFolder = `${contract?.idNumber || user?.cedula || req.user._id}_${(contract?.contractorName || user?.fullName || 'Contratista').replace(/[^a-zA-Z0-9]/g, '_')}`;
        const targetAct = parseInt(actNumber) || 1;

        // Handle uploaded evidences grouped by activity index
        // Multer holds them in memory as req.files['evidence_0'], req.files['evidence_1'], etc.
        if (req.files) {
            for (const fieldKey of Object.keys(req.files)) {
                const match = fieldKey.match(/^evidence_(\d+)$/);
                if (match) {
                    const idx = parseInt(match[1], 10);
                    if (parsedActivities[idx]) {
                        if (!parsedActivities[idx].evidences) parsedActivities[idx].evidences = [];
                        for (const f of req.files[fieldKey]) {
                            const fBuffer = f.buffer || (f.path && fs.existsSync(f.path) ? fs.readFileSync(f.path) : null);
                            if (fBuffer) {
                                const uploaded = await storageService.saveFile({
                                    buffer: fBuffer,
                                    filename: f.originalname,
                                    mimetype: f.mimetype,
                                    pathSegments: ['Contratistas', contractorFolder, `Acta_${targetAct}`, 'Evidencias']
                                });
                                parsedActivities[idx].evidences.push({
                                    filename: f.originalname,
                                    path: uploaded.path,
                                    driveId: uploaded.driveId,
                                    mimetype: f.mimetype
                                });
                            }
                        }
                    }
                }
            }
        }

        // Parse securitySocial if JSON string
        let parsedSS = securitySocial;
        if (typeof securitySocial === 'string') {
            try { parsedSS = JSON.parse(securitySocial); } catch (_) { parsedSS = {}; }
        }

        // Handle security social file path if provided
        let ssPath = req.body.securitySocialPath || '';
        if (req.files && req.files['securitySocialFile'] && req.files['securitySocialFile'][0]) {
            const ssFile = req.files['securitySocialFile'][0];
            const ssBuffer = ssFile.buffer || (ssFile.path && fs.existsSync(ssFile.path) ? fs.readFileSync(ssFile.path) : null);
            if (ssBuffer) {
                const uploadedSS = await storageService.saveFile({
                    buffer: ssBuffer,
                    filename: ssFile.originalname,
                    mimetype: ssFile.mimetype,
                    pathSegments: ['Contratistas', contractorFolder, `Acta_${targetAct}`, 'Planilla']
                });
                ssPath = uploadedSS.path;
            }
        }

        // Handle security social receipt file (comprobante de pago de planilla)
        let ssReceiptPath = req.body.securitySocialReceiptPath || '';
        if (req.files && req.files['securitySocialReceiptFile'] && req.files['securitySocialReceiptFile'][0]) {
            const ssRFile = req.files['securitySocialReceiptFile'][0];
            const ssRBuffer = ssRFile.buffer || (ssRFile.path && fs.existsSync(ssRFile.path) ? fs.readFileSync(ssRFile.path) : null);
            if (ssRBuffer) {
                const uploadedSSR = await storageService.saveFile({
                    buffer: ssRBuffer,
                    filename: ssRFile.originalname,
                    mimetype: ssRFile.mimetype,
                    pathSegments: ['Contratistas', contractorFolder, `Acta_${targetAct}`, 'Comprobante_Pago_SS']
                });
                ssReceiptPath = uploadedSSR.path;
            }
        }

        // Upsert: one draft per actNumber per contract per user (status pending)
        const query = {
            user: req.user._id,
            actNumber: targetAct,
            status: 'pending'
        };
        if (contractId) query.contract = contractId;

        let period = await BillingPeriod.findOne(query);

        if (period) {
            period.periodFrom    = periodFrom   || period.periodFrom;
            period.periodTo      = periodTo     || period.periodTo;
            period.activities    = parsedActivities || period.activities;
            period.securitySocial = parsedSS    || period.securitySocial;
            if (contractId && !period.contract) period.contract = contractId;
            if (ssPath) period.securitySocialPath = ssPath;
            if (ssReceiptPath) period.securitySocialReceiptPath = ssReceiptPath;
            await period.save();
        } else {
            period = await BillingPeriod.create({
                user:           req.user._id,
                contract:       contractId || null,
                actNumber:      targetAct,
                periodFrom,
                periodTo,
                activities:     parsedActivities || [],
                securitySocial: parsedSS || {},
                securitySocialPath: ssPath,
                securitySocialReceiptPath: ssReceiptPath
            });
        }

        if (ssPath) {
            const contractQuery = { user: req.user._id };
            if (contractId) contractQuery._id = contractId;
            await Contract.findOneAndUpdate(contractQuery, { securitySocialPath: ssPath });
        }

        res.json({ message: 'Borrador y evidencias guardados en Google Drive correctamente', data: period });
    } catch (err) {
        console.error('Error saveBillingPeriod:', err);
        res.status(500).json({ message: 'Error al guardar el periodo', error: err.message });
    }
};

// ──────────────────────────────────────────────────────────────
// Helper / Function: Generate all 4 Word docs + ZIP for a BillingPeriod
// ──────────────────────────────────────────────────────────────
const generateBillingPackage = async (periodId, userId, options = {}) => {
    const { sendToNextcloud = false } = options;
    const period = await BillingPeriod.findOne({ _id: periodId, user: userId });
    if (!period) throw new Error('Periodo no encontrado');

    let contract = null;
    if (period.contract) {
        contract = await Contract.findById(period.contract);
    }
    if (!contract) {
        contract = await Contract.findOne({ user: userId }).sort({ createdAt: -1 });
    }
    if (!contract) throw new Error('Debe configurar su contrato antes de generar el paquete');

    const user = await User.findById(userId).select('-password');
    if (!user) throw new Error('Usuario no encontrado');

        // ── Compute Social Security and IBC with PILA compliance ──
        const ssData = calculateSocialSecurity(contract, period, period.securitySocial);
        const ibc = ssData.ibc;
        contract.ibcValue = ibc;
        await contract.save();

        // ── Determine Addition logic ──────────────────────────────
        // If the contract has an addition, we apply addition formatting once initial duration acts are completed
        const periodIsAddition = contract.hasAddition && (period.actNumber > (contract.initialDurationMonths || 4));
        
        const rawTotalVal = parseFloat(contract.totalValue) || 0;
        const rawAddVal = parseFloat(contract.additionValue) || 0;
        const combinedTotalVal = rawTotalVal + rawAddVal;
        
        let combinedValWord = contract.totalValueWord || '';
        if (contract.hasAddition && contract.additionValueWord) {
            combinedValWord = `${contract.totalValueWord} MÁS ADICIÓN DE ${contract.additionValueWord}`;
        }

        // ── Build common data object for all 4 templates ─────────
        const { mes, anio } = monthYearEs(period.periodTo);

        // Calculate remaining balance (including addition value if applicable)
        const usedValue = period.actNumber * (parseFloat(contract.monthlyValue) || 0);
        const remainingVal = Math.max(0, combinedTotalVal - usedValue);

        // Map act number to Spanish text representation
        const ACT_TEXTS = {
            1: "PRIMER PAGO",
            2: "SEGUNDO PAGO",
            3: "TERCER PAGO",
            4: "CUARTO PAGO",
            5: "QUINTO PAGO",
            6: "SEXTO PAGO",
            7: "SEPTIMO PAGO",
            8: "OCTAVO PAGO",
            9: "NOVENO PAGO",
            10: "DECIMO PAGO"
        };

        // Determine Month and Year in Spanish capitalised for stamps (e.g. "Abril 2026")
        const mesEsCapitalized = mes.charAt(0) + mes.slice(1).toLowerCase();
        const periodMonthYear = `${mesEsCapitalized} ${anio}`;

        // Determine contract type checkboxes for stamps and other formats
        const contractTypeClean = (contract.contractType || '').toLowerCase();
        const isApoyo = contractTypeClean.includes('apoyo') || contractTypeClean.includes('gesti');
        const isProfesional = contractTypeClean.includes('profesional') || (!isApoyo && contractTypeClean.includes('servicios'));
        const isObra = contractTypeClean.includes('obra');
        const isConsultoria = contractTypeClean.includes('consultor');
        const isCompraventa = contractTypeClean.includes('compra') || contractTypeClean.includes('suministro');
        const isProveedor = contractTypeClean.includes('proveedor');
        const isOtro = !isApoyo && !isProfesional && !isObra && !isConsultoria && !isCompraventa && !isProveedor;

        // Checkboxes characters
        const chkApoyo = isApoyo ? "[ X ]" : "[   ]";
        const chkProfesional = isProfesional ? "[ X ]" : "[   ]";
        const chkObra = isObra ? "[ X ]" : "[   ]";
        const chkConsultoria = isConsultoria ? "[ X ]" : "[   ]";
        const chkSuministros = isCompraventa ? "[ X ]" : "[   ]";
        const chkProveedor = isProveedor ? "[ X ]" : "[   ]";
        const chkOtro = isOtro ? "[ X ]" : "[   ]";

        // Formatted currency strings
        const totalValFormatted = Number(contract.totalValue || 0).toLocaleString('es-CO');
        const monthlyValFormatted = Number(contract.monthlyValue || 0).toLocaleString('es-CO');
        const remainingValFormatted = remainingVal.toLocaleString('es-CO');

        // Forma de pago respetando el párrafo completo del apartado 4 (VALOR Y FORMA DE PAGO) de la minuta
        let formaPagoText = (contract.paymentTerms || contract.formaPago || '').trim();
        formaPagoText = formaPagoText.replace(/^(CUARTA|CL[AÁ]USULA\s+CUARTA)[.\s:]*(VALOR\s+Y\s+FORMA\s+DE\s+PAGO)?:?\s*/i, '').trim();

        if (!formaPagoText) {
            const totalWord = (contract.totalValueWord || '').trim();
            const numPagos = contract.initialDurationMonths || 4;
            const numPagosPadded = String(numPagos).padStart(2, '0');
            const monthlyWord = (contract.monthlyValueWord || '').trim();

            if (totalValFormatted && totalValFormatted !== '0' && monthlyValFormatted && monthlyValFormatted !== '0') {
                const totalStr = totalWord ? `${totalWord} ($${totalValFormatted})` : `$${totalValFormatted}`;
                const monthlyStr = monthlyWord ? `${monthlyWord} ($${monthlyValFormatted})` : `$${monthlyValFormatted}`;
                formaPagoText = `${totalStr}, pagaderos de la siguiente manera: ${numPagos} Pagos (${numPagosPadded}) pago por valor de ${monthlyStr}, previa verificación del pago de la seguridad social y entrega a satisfacción del informe de actividades realizadas y visto bueno por parte del funcionario encargado de ejercer la vigilancia y control. NOTA: El último pago queda supeditado a la entrega de la totalidad de los archivos y documentos correspondientes a la ejecución contractual cuando haya lugar. No obstante, la forma de pago prevista, queda sujeta a la situación de los recursos del plan anual mensualizado de caja PAC.`;
            } else {
                formaPagoText = contract.paymentMethod
                    ? (contract.paymentMethod.toLowerCase().includes('cuenta')
                        ? `${contract.paymentMethod} No. ${contract.accountNumber || ''}`
                        : `Transferencia Cuenta ${contract.paymentMethod} No. ${contract.accountNumber || ''}`)
                    : (contract.accountNumber ? `Transferencia Cuenta No. ${contract.accountNumber}` : 'Transferencia Electrónica');
            }
        }

        // Security Social values formatting with intelligent fallbacks
        const ssOperator = ssData.operator || period.securitySocial?.operator || 'SIMPLE';
        const ssPlanilla = ssData.planillaNumber || period.securitySocial?.planillaNumber || '';
        const rawSalud = Number(ssData.saludPaid || 0);
        const rawPension = Number(ssData.pensionPaid || 0);
        const rawArl = Number(ssData.arlPaid || 0);
        const rawTotalSS = Number(ssData.totalPaid || (rawSalud + rawPension + rawArl));

        const saludValFormatted = rawSalud.toLocaleString('es-CO');
        const pensionValFormatted = rawPension.toLocaleString('es-CO');
        const arlValFormatted = rawArl.toLocaleString('es-CO');
        const ssTotalFormatted = rawTotalSS.toLocaleString('es-CO');

        // Tax / Retención options
        const takesCosts = !!contract.takesCosts;
        const takesExemptRent = contract.takesExemptRent === true;
        const isTaxFiler = !!contract.isTaxFiler;
        const previousTaxYear = (parseInt(anio, 10) - 1).toString();

        // Plazo de ejecución respetando la minuta (ej. 115 días calendario)
        let plazoEjecucionText = (contract.executionTerm || '').trim();
        if (!plazoEjecucionText) {
            if (contract.startDate && contract.endDate) {
                try {
                    const rawStart = String(contract.startDate).split('T')[0].trim();
                    const rawEnd = String(contract.endDate).split('T')[0].trim();
                    const [sy, sm, sd] = rawStart.split('-').map(Number);
                    const [ey, em, ed] = rawEnd.split('-').map(Number);
                    if (!isNaN(sy) && !isNaN(sm) && !isNaN(sd) && !isNaN(ey) && !isNaN(em) && !isNaN(ed)) {
                        const start = new Date(sy, sm - 1, sd);
                        const end = new Date(ey, em - 1, ed);
                        const diffTime = end.getTime() - start.getTime();
                        if (diffTime >= 0) {
                            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
                            if (contract.periodType === '30_dias' || diffDays % 30 !== 0) {
                                plazoEjecucionText = `${diffDays} DÍAS CALENDARIO`;
                            }
                        }
                    }
                } catch (_) {}
            }
        }
        if (!plazoEjecucionText) {
            if (contract.periodType === '30_dias' && contract.initialDurationMonths) {
                plazoEjecucionText = `${contract.initialDurationMonths * 30} DÍAS CALENDARIO`;
            } else if (contract.initialDurationMonths) {
                plazoEjecucionText = `${contract.initialDurationMonths} MESES`;
            } else {
                plazoEjecucionText = 'CUATRO (04) MESES';
            }
        }
        if (contract.hasAddition && contract.additionDuration) {
            plazoEjecucionText += ` MÁS ADICIÓN DE ${contract.additionDuration}`;
        }

        const periodToDateObj = parseDateSafe(period.periodTo) || new Date();
        const toDay = periodToDateObj.getDate();
        const isCustomDate = Boolean(contract.customDeliveryDate && (formatDateNumeric(period.periodTo) === formatDateNumeric(contract.customDeliveryDate)));
        const actaParcialDia = (isCustomDate || toDay < 25)
            ? String(toDay).padStart(2, '0')
            : String(new Date(periodToDateObj.getFullYear(), periodToDateObj.getMonth() + 1, 0).getDate()).padStart(2, '0');
        const actaParcialMesNum = String(periodToDateObj.getMonth() + 1).padStart(2, '0');
        const fechaCorteSign = `${actaParcialDia} - ${actaParcialMesNum} - ${periodToDateObj.getFullYear()}`;

        // Generar texto formal de resumen de evidencias para el Informe de Actividades con IA
        let evidenciasEjecucionTexto;
        try {
            evidenciasEjecucionTexto = await generateExecutionEvidencesSummary({
                contractObject: contract.contractObject,
                contractType: contract.contractType,
                activities: period.activities
            });
        } catch (_) {
            evidenciasEjecucionTexto = formatEvidencesText(period.activities);
        }

        // Effective end date calculation fallback (e.g. from executionTerm or initialDurationMonths)
        let effectiveEndDate = contract.endDate;
        if (!effectiveEndDate && contract.startDate) {
            const daysMatch = (contract.executionTerm || '').match(/(\d+)\s*d[ií]as/i);
            const numDays = daysMatch ? parseInt(daysMatch[1], 10) : (contract.initialDurationMonths ? contract.initialDurationMonths * 30 : null);
            if (numDays) {
                const sDate = parseDateSafe(contract.startDate);
                if (sDate) {
                    const eDate = new Date(sDate.getTime() + (numDays - 1) * 24 * 60 * 60 * 1000);
                    effectiveEndDate = eDate.toISOString().split('T')[0];
                }
            }
        }

        const commonData = {
            // ── NUEVAS VARIABLES (snake_case) para CERTIFICADO DEL SUPERVISOR ──
            fecha_certificado:                 fechaCorteSign,
            nombre_supervisor:                 contract.supervisorName || '',
            dependencia:                       getFormatNameForDependency(contract.supervisorDependency, 'SECRETARIA DE PLANEACION', contract.unidadEjecutoraCodigo),
            nombre_contratista:                contract.contractorName || user.fullName || '',
            identificacion_contratista:        contract.idNumber || '',
            tipo_contrato:                     contract.contractType || 'PRESTACIÓN DE SERVICIOS DE APOYO A LA GESTION',
            numero_contrato:                   contract.contractNumber || '',
            fecha_acta_inicio:                 contract.startDate ? formatDateEs(contract.startDate) : '',
            fecha_terminacion:                 (periodIsAddition && contract.additionEndDate) ? formatDateEs(contract.additionEndDate) : (effectiveEndDate ? formatDateEs(effectiveEndDate) : ''),
            cdp:                               periodIsAddition ? (contract.additionCdp || contract.cdp || '') : (contract.cdp || ''),
            rp:                                periodIsAddition ? (contract.additionRp || contract.rp || '') : (contract.rp || ''),
            rubro_presupuestal:                formatRubroPresupuestal(
                periodIsAddition ? (contract.additionRubro || contract.rubro || '') : (contract.rubro || ''),
                contract.fuenteCodigo || contract.fuenteFinanciacion
            ),
            rubrol:                            formatRubroPresupuestal(
                periodIsAddition ? (contract.additionRubro || contract.rubro || '') : (contract.rubro || ''),
                contract.fuenteCodigo || contract.fuenteFinanciacion
            ),
            valor_total:                       contract.hasAddition ? combinedTotalVal.toLocaleString('es-CO') : totalValFormatted,
            entidad_bancaria:                  contract.bankName || '',
            valor_autorizado_pago:             monthlyValFormatted,
            numero_cuenta:                     contract.accountNumber || '',
            saldo_restante:                    remainingValFormatted,
            forma_pago:                        formaPagoText,
            periodo_pagar_inicio:              formatDateNumeric(period.periodFrom),
            periodo_pagar_fin:                 formatDateNumeric(period.periodTo),
            mes_planilla:                      ssData.period || mes,
            numero_planilla:                   ssPlanilla,
            valor_pension:                     pensionValFormatted,
            valor_salud:                       saludValFormatted,
            valor_arl:                         arlValFormatted,
            valor_pago_certificado:            monthlyValFormatted,
            soporte_acta_inicio_folios:        period.actNumber === 1 ? "1" : "0",
            soporte_informe_contratista_folios: "2",
            soporte_informe_supervisor_folios:  "1",
            soporte_planilla_folios:           "1",
            soporte_recibo_folios:             "1",
            soportes_otros:                    "Planilla de Seguridad Social: 1 folio(s).\nRecibo de pago: 1 folio(s)\nRUT: 1 folio(s)\nCertificación Bancaria: 1 folio(s)\nDescuento de Estampillas 1 folio(s)\nRetención en la Fuente: 1 folio(s)\nRP: 1 folio(s)",
            chk_anticipo:                      "___",
            chk_primero:                       period.actNumber === 1 ? "_ X _" : "___",
            chk_segundo:                       period.actNumber === 2 ? "_ X _" : "___",
            chk_tercero:                       period.actNumber === 3 ? "_ X _" : "___",
            chk_cuarto:                        period.actNumber === 4 ? "_ X _" : "___",
            chk_quinto:                        period.actNumber === 5 ? "_ X _" : "___",
            chk_sexto:                         period.actNumber === 6 ? "_ X _" : "___",
            chk_septimo:                       period.actNumber === 7 ? "_ X _" : "___",
            chk_octavo:                        period.actNumber === 8 ? "_ X _" : "___",
            chk_noveno:                        period.actNumber === 9 ? "_ X _" : "___",
            chk_otros:                         period.actNumber > 9 ? "_ X _" : "___",
            otros_cual:                        period.actNumber > 9 ? (ACT_TEXTS[period.actNumber] || `PAGO ${period.actNumber}`) : "",

            // ── NUEVAS VARIABLES (snake_case) para INFORME DE ACTIVIDADES ──
            objeto_contrato:                   contract.contractObject || '',
            plazo_ejecucion:                   plazoEjecucionText,
            acta_parcial_anio:                 periodToDateObj.getFullYear().toString(),
            acta_parcial_mes:                  actaParcialMesNum,
            acta_parcial_dia:                  actaParcialDia,
            numero_acta_parcial:               period.actNumber.toString(),
            periodo_informado_inicio:          formatDateNumeric(period.periodFrom),
            periodo_informado_fin:             formatDateNumeric(period.periodTo),
            actividades_desarrolladas:         formatActivitiesText(period.activities),
            evidencias_ejecucion:              evidenciasEjecucionTexto || formatEvidencesText(period.activities),
            anticipo:                          "0",
            valor_acta_1:                      period.actNumber >= 1 ? monthlyValFormatted : "0",
            valor_acta_2:                      period.actNumber >= 2 ? monthlyValFormatted : "0",
            valor_acta_3:                      period.actNumber >= 3 ? monthlyValFormatted : "0",
            valor_acta_n:                      period.actNumber > 3 ? monthlyValFormatted : "0",
            saldo_pendiente:                   remainingValFormatted,
            otros_contratos_si:                "[   ]",
            otros_contratos_no:                "[ X ]",
            valor_ingresos_mensualizados:      monthlyValFormatted,
            valor_ibc:                         ibc.toLocaleString('es-CO'),
            entidad_pago_aportes:              ssOperator,
            valor_total_aporte:                ssTotalFormatted,
            numero_recibo_aportes:             ssPlanilla,
            periodo_cotizado_inicio:           ssData.periodCotizadoInicio || formatDateNumeric(period.periodFrom),
            periodo_cotizado_fin:              ssData.periodCotizadoFin || formatDateNumeric(period.periodTo),
            chk_recibo_pago_ss:                "[ X ]",
            chk_copias_planillas:              "[ X ]",
            chk_anexos_otros:                  "[   ]",
            observaciones:                     period.observations ? period.observations : "(Este espacio es para que el Supervisor (a) realice las anotaciones del caso, respecto del avance de ejecución del contrato, y en general, todas aquellas que pretenda hacer valer respecto del cumplimiento de las obligaciones pactadas con el contratista).",
            firma_supervisor:                  contract.supervisorName || '',

            // ── NUEVAS VARIABLES (snake_case) para DESCUENTO DE ESTAMPILLAS ──
            ciudad_fecha_estampillas:          `${contract.idCity || 'Armenia'} Quindío, ${mes.toLowerCase()} de ${anio}`,
            cedula_expedicion_larga:           `${contract.idNumber || ''} de ${contract.idCity || 'Armenia'}- Quindío`,
            direccion_telefono_contratista:    `${contract.contractorAddress || ''} ${contract.idCity || 'Armenia'} -Quindío Teléfono: ${contract.contractorPhone || ''}`,
            especificar_contrato_estampillas:  `${(contract.contractType || 'PRESTACIÓN DE SERVICIOS DE APOYO A LA GESTION').toUpperCase()}   ${contract.contractNumber || ''}`,
            ciudad_fecha:                      `${contract.idCity || 'Armenia'} Quindío, ${mes.toLowerCase()} de ${anio}`,
            direccion_contratista:             contract.contractorAddress || '',
            telefono_contratista:              contract.contractorPhone || '',
            chk_estampilla_pro_desarrollo:     "[ X ]",
            chk_estampilla_pro_hospital:       "[ X ]",
            chk_estampilla_pro_cultura:        "[ X ]",
            chk_estampilla_pro_bienestar:      "[ X ]",
            chk_contrato_apoyo_gestion:        chkApoyo,
            chk_contrato_prof_servicios:       chkProfesional,
            chk_contrato_obra:                 chkObra,
            chk_contrato_consultoria:          chkConsultoria,
            chk_contrato_compraventa:          chkSuministros,
            chk_contrato_proveedor:            chkProveedor,
            chk_contrato_otro:                 chkOtro,
            tipo_contrato_otro_cual:           isOtro ? (contract.contractType || '') : '',
            firma_contratista:                 contract.contractorName || user.fullName || '',
            lugar_expedicion_cc:               contract.idCity || 'Armenia-Quindío',

            // ── NUEVAS VARIABLES (snake_case) para RETENCION EN LA FUENTE ──
            mes_documento:                     mes.toLowerCase(),
            anio_documento:                    anio,
            valor_a_pagar_acta_actual:         monthlyValFormatted,
            chk_costos_deducciones_no:         takesCosts ? "[   ]" : "[ X ]",
            chk_costos_deducciones_si:         takesCosts ? "[ X ]" : "[   ]",
            chk_renta_exenta_si:               takesExemptRent ? "[ X ]" : "[   ]",
            chk_renta_exenta_no:               takesExemptRent ? "[   ]" : "[ X ]",
            anio_vigencia_anterior:            previousTaxYear,
            chk_declarante_renta_si:           isTaxFiler ? "[ X ]" : "[   ]",
            chk_declarante_renta_no:           isTaxFiler ? "[   ]" : "[ X ]",
            correo_contratista:                contract.contractorEmail || user.email || '',

            // ── VARIABLES LEGACY (camelCase) para compatibilidad con INFORME DE ACTIVIDADES ──
            contractorName:   contract.contractorName    || user.fullName || '',
            idNumber:         contract.idNumber           || '',
            contractNumber:   contract.contractNumber     || '',
            contractType:     contract.contractType       || '',
            contractObject:   contract.contractObject     || '',
            supervisorName:   contract.supervisorName     || '',
            supervisorDependency: getFormatNameForDependency(contract.supervisorDependency, 'SECRETARIA DE PLANEACION', contract.unidadEjecutoraCodigo),
            contractorAddress: contract.contractorAddress || '',
            contractorPhone:   contract.contractorPhone   || '',
            startDate:        contract.startDate ? formatDateEs(contract.startDate) : '',
            endDate:          (periodIsAddition && contract.additionEndDate) ? formatDateEs(contract.additionEndDate) : (effectiveEndDate ? formatDateEs(effectiveEndDate) : ''),
            periodMonthYear,
            chkApoyo,
            chkProfesional,
            chkObra,
            chkConsultoria,
            chkSuministros,
            chkProveedor,
            chkOtro,
            totalValue:       totalValFormatted,
            totalValueWord:   contract.totalValueWord     || '',
            monthlyValue:     monthlyValFormatted,
            monthlyValueWord: contract.monthlyValueWord   || '',
            ibcValue:         ibc.toLocaleString('es-CO'),
            rpNumber:         periodIsAddition ? (contract.additionRp || contract.rp || '') : (contract.rp || ''),
            cdpNumber:        periodIsAddition ? (contract.additionCdp || contract.cdp || '') : (contract.cdp || ''),
            rubro:            formatRubroPresupuestal(
                periodIsAddition ? (contract.additionRubro || contract.rubro || '') : (contract.rubro || ''),
                contract.fuenteCodigo || contract.fuenteFinanciacion
            ),
            actNumber:        period.actNumber.toString(),
            periodFrom:       formatDateNumeric(period.periodFrom),
            periodTo:         formatDateNumeric(period.periodTo),
            mes,
            anio,
            hasAddition:       periodIsAddition,
            additionValue:     rawAddVal.toLocaleString('es-CO'),
            additionValueWord: contract.additionValueWord || '',
            additionStartDate: contract.additionStartDate ? formatDateNumeric(contract.additionStartDate) : '',
            additionEndDate:   contract.additionEndDate ? formatDateNumeric(contract.additionEndDate) : '',
            additionCdp:       contract.additionCdp || '',
            additionRp:        contract.additionRp || '',
            additionRubro:     contract.additionRubro || '',
            additionDuration:  contract.additionDuration || '',
            totalValueWithAddition: combinedTotalVal.toLocaleString('es-CO'),
            totalValueWithAdditionWord: combinedValWord,
            ssOperator:       period.securitySocial?.operator      || '',
            ssPlanilla:       period.securitySocial?.planillaNumber || '',
            ssTotalPaid:      ssTotalFormatted,
            ssSalud:          saludValFormatted,
            ssPension:        pensionValFormatted,
            ssArl:            arlValFormatted,
            ssPeriod:         period.securitySocial?.period || mes,
            bankName:         contract.bankName          || '',
            accountNumber:    contract.accountNumber     || '',
            paymentMethod:    contract.paymentMethod     || '',
            periodToDate:     formatDateNumeric(period.periodTo),
            remainingValue:   remainingValFormatted,
            foliosContratista: "2",
            foliosSupervisor:  "1",
            actNumberText:     ACT_TEXTS[period.actNumber] || `${period.actNumber} PAGO`,

            // Activities array (for loops in templates)
            activities: (period.activities || []).map((act, i) => ({
                num:             (i + 1).toString(),
                obligationCode:  act.obligationCode || '',
                obligationText:  act.obligationText || '',
                comment:         act.comment        || ''
            }))
        };

        const isTicContract = /tic|tecnolog/i.test(contract.supervisorDependency || '') ||
                              /tic|tecnolog/i.test(contract.unidadEjecutora || '') ||
                              Boolean(contract.isTicContract);
        const shouldSendToNextcloud = Boolean(sendToNextcloud && isTicContract);

        const outputDir = path.resolve(__dirname, '..', 'generated');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Helper para asegurar que los "Anexo Descripcion #[codigo]" estén creados
        let annexesGenerated = false;
        async function ensureAnnexesGenerated() {
            if (annexesGenerated) return;
            annexesGenerated = true;

            for (let i = 0; i < (period.activities || []).length; i++) {
                const act = period.activities[i];
                const code = act.obligationCode || `2.2.${i + 1}`;
                const text = act.obligationText || '';
                const allEvidences = act.evidences || [];

                const photos = allEvidences.filter(isImageEvidence);
                const docs = allEvidences.filter(ev => !isImageEvidence(ev));
                const annexImages = [];

                if (photos.length > 0) {
                    for (const photoEv of photos) {
                        try {
                            const imgData = await annexService.renderEvidenceToImage(photoEv);
                            if (imgData) annexImages.push(imgData);
                        } catch (pErr) {
                            console.warn(`⚠️ Error al procesar imagen para Anexo Obligación ${code}:`, pErr.message);
                        }
                    }
                }

                if (photos.length === 0 && docs.length > 0) {
                    for (const docEv of docs) {
                        try {
                            const imgData = await annexService.renderEvidenceToImage(docEv);
                            if (imgData) annexImages.push(imgData);
                        } catch (dErr) {
                            console.warn(`⚠️ Error al generar captura de primera página para soporte en Obligación ${code}:`, dErr.message);
                        }
                    }
                }

                if (annexImages.length > 0 || (act.comment && act.comment.trim().length > 0)) {
                    try {
                        const extendedDesc = await generateObligationAnnexDescription({
                            obligationCode: code,
                            obligationText: text,
                            contractorComment: act.comment,
                            evidences: allEvidences,
                            imageCount: Math.max(1, annexImages.length)
                        });

                        const annexBuf = await annexService.generateAnnexDocument({
                            obligationCode: code,
                            obligationText: text,
                            images: annexImages,
                            description: extendedDesc
                        });

                        const safeCode = (code || 'General').trim().replace(/[^a-zA-Z0-9.-]/g, '_');
                        const annexFileName = `${Date.now()}-Anexo_Descripcion_${safeCode}.docx`;
                        const annexFilePath = path.join(outputDir, annexFileName);
                        fs.writeFileSync(annexFilePath, annexBuf);

                        act.annexDescription = extendedDesc;
                        act.annexDocPath = annexFilePath;

                        try {
                            const safeName = (user.fullName || 'Contratista').replace(/[^a-zA-Z0-9]/g, '_');
                            const contractorFolder = `${contract?.idNumber || user?.cedula || user?._id}_${safeName}`;
                            const driveUpload = await storageService.saveFile({
                                buffer: annexBuf,
                                filename: `Anexo Descripcion ${code}.docx`,
                                mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                pathSegments: ['Contratistas', contractorFolder, `Acta_${period.actNumber}`, 'Anexos_Descripcion']
                            });
                            act.annexDriveId = driveUpload.driveId;
                        } catch (driveErr) {
                            console.warn(`⚠️ No se pudo respaldar Anexo Descripción ${code} en Drive:`, driveErr.message);
                        }
                    } catch (annexErr) {
                        console.warn(`⚠️ Error al generar Anexo Descripción para Obligación ${code}:`, annexErr.message);
                    }
                }
            }
        }

        let nextcloudScreenshotsByCode = new Map();
        let nextcloudBasePath = contract.nextcloudBasePath || process.env.NEXTCLOUD_BASE_PATH || '/INFRAESTRUCTURA TIC/MESA DE AYUDA';
        let nextcloudContractorName = contract.contractorName || user.fullName || 'Contratista';
        let nextcloudContractNumber = contract.contractNumber || 'Contrato';
        let nextcloudAccountPath = null;

        if (shouldSendToNextcloud) {
            console.log('🚀 Flujo Secretaría TIC activado: Generando anexos y subiendo a Nextcloud NAS...');
            await ensureAnnexesGenerated();

            nextcloudAccountPath = nextcloudService.buildAccountPath({
                basePath: nextcloudBasePath,
                contractorName: nextcloudContractorName,
                contractNumber: nextcloudContractNumber,
                accountNumber: period.actNumber
            });

            const foldersToCapture = [];
            const uploadsDir = path.resolve(__dirname, '..', 'uploads');
            if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

            for (let i = 0; i < (period.activities || []).length; i++) {
                const act = period.activities[i];
                const rawCode = (act.obligationCode || `2.2.${i + 1}`).trim();
                const cleanCode = rawCode.replace(/\.+$/, '');
                const targetFolder = `${nextcloudAccountPath}/EVIDENCIAS/${cleanCode}`;

                try {
                    await nextcloudService.ensureDirectory(targetFolder);

                    // 1. Subir Anexo Descripción si existe
                    if (act.annexDocPath && fs.existsSync(act.annexDocPath)) {
                        await nextcloudService.uploadLocalFile(
                            `${targetFolder}/Anexo Descripcion ${cleanCode}.docx`,
                            act.annexDocPath
                        );
                    }

                    // 2. Subir evidencias (fotos y documentos)
                    for (let evIdx = 0; evIdx < (act.evidences || []).length; evIdx++) {
                        const ev = act.evidences[evIdx];
                        const evPath = ev.path || ev.driveId;
                        if (evPath) {
                            const evBuf = await storageService.getFileBuffer(evPath);
                            if (evBuf) {
                                const ext = path.extname(ev.filename || evPath) || '.jpg';
                                const isImg = isImageEvidence(ev);
                                const destName = isImg ? `Foto_${evIdx + 1}${ext}` : `Soporte_${cleanCode}_${evIdx + 1}${ext}`;
                                await nextcloudService.uploadBuffer(`${targetFolder}/${destName}`, evBuf);
                            }
                        }
                    }

                    // 3. Programar captura de pantalla de esta obligación
                    const outScreenshotPath = path.join(uploadsDir, `pantallazo_nextcloud_${cleanCode}_${Date.now()}.png`);
                    foldersToCapture.push({
                        cleanCode,
                        folderPath: targetFolder,
                        outputPath: outScreenshotPath
                    });
                } catch (ticFolderErr) {
                    console.warn(`⚠️ Error al preparar carpeta ${targetFolder} en Nextcloud:`, ticFolderErr.message);
                }
            }

            if (foldersToCapture.length > 0) {
                console.log(`📸 Tomando ${foldersToCapture.length} pantallazos en Nextcloud para Secretaría TIC...`);
                try {
                    const captureResults = await nextcloudService.captureMultipleFoldersScreenshots(foldersToCapture, {
                        viewport: { width: 1600, height: 900 }
                    });
                    for (const item of captureResults) {
                        if (item.success && fs.existsSync(item.outputPath)) {
                            nextcloudScreenshotsByCode.set(item.cleanCode, fs.readFileSync(item.outputPath));
                        }
                    }
                } catch (captureErr) {
                    console.error('❌ Error durante la captura de pantallazos en Nextcloud:', captureErr.message);
                }
            }
        }

        const fotos_evidencias = [];
        const lista_actividades = [];

        for (let i = 0; i < (period.activities || []).length; i++) {
            const act = period.activities[i];
            const rawCode = (act.obligationCode || `2.2.${i + 1}`).trim();
            const cleanCode = rawCode.replace(/\.+$/, '');
            const lastNumMatch = cleanCode.match(/\d+$/);
            const actNum = lastNumMatch ? lastNumMatch[0] : (i + 1).toString();

            let cleanOblText = (act.obligationText || '').trim();
            cleanOblText = cleanOblText.replace(/^obligaci[oó]n\s*[\d.]*:?\s*/i, '').trim();
            const codePattern = cleanCode.replace(/\./g, '\\.');
            cleanOblText = cleanOblText.replace(new RegExp(`^${codePattern}\\.?\\s*`, 'i'), '').trim();
            cleanOblText = cleanOblText.replace(/^[\d.]+\.?\s*/, '').trim();

            const encabezado_obligacion = `${cleanCode}. ${cleanOblText}`;

            let comment = (act.comment && act.comment.trim().length > 0)
                ? act.comment.trim()
                : 'Actividades ejecutadas a satisfacción durante el periodo reportado.';

            // Quitar numeración previa si el contratista ya la escribió (ej: "5 " o "5. ")
            comment = comment.replace(new RegExp(`^${actNum}[.\\s-]+\\s*`, 'i'), '').trim();
            comment = comment.replace(/^\d+[.\s-]+\s*/, '').trim();

            const fotos = [];
            const documentos = [];

            const imageEvidences = (act.evidences || []).filter(isImageEvidence);
            const docEvidences = (act.evidences || []).filter(ev => !isImageEvidence(ev));

            // Si es Secretaría TIC y tenemos la captura de la NAS, usarla en lugar de las fotos individuales
            if (shouldSendToNextcloud && nextcloudScreenshotsByCode.has(cleanCode)) {
                const nasScreenshot = nextcloudScreenshotsByCode.get(cleanCode);
                fotos.push({
                    descripcion: 'Registro de evidencias en NAS Nextcloud (Secretaría TIC)',
                    foto: nasScreenshot
                });
                fotos_evidencias.push({
                    codigo: cleanCode,
                    descripcion: 'Registro de evidencias en NAS Nextcloud (Secretaría TIC)',
                    foto: nasScreenshot
                });
            } else {
                // Flujo tradicional (o dependencias no-TIC): incluir fotos individuales
                const totalPhotos = imageEvidences.length;
                let photoIndex = 0;

                for (const ev of imageEvidences) {
                    if (ev.path || ev.driveId) {
                        photoIndex++;
                        const photoBuffer = await storageService.getFileBuffer(ev.path || ev.driveId);
                        if (photoBuffer) {
                            const rawDesc = (ev.description || '').trim();
                            const isDuplicateComment = rawDesc.toLowerCase() === comment.toLowerCase();
                            const hasCustomCaption = rawDesc.length > 0 && !isDuplicateComment;

                            let captionText;
                            if (totalPhotos > 1) {
                                if (hasCustomCaption) {
                                    captionText = `Registro fotográfico ${photoIndex} de ${totalPhotos}: ${rawDesc}`;
                                } else {
                                    captionText = `Registro fotográfico ${photoIndex} de ${totalPhotos}: Soporte de ejecución de la obligación ${cleanCode}`;
                                }
                            } else {
                                if (hasCustomCaption) {
                                    captionText = `Registro fotográfico: ${rawDesc}`;
                                } else {
                                    captionText = `Registro fotográfico: Soporte de ejecución de la actividad`;
                                }
                            }

                            fotos.push({
                                descripcion: captionText,
                                foto: photoBuffer
                            });

                            fotos_evidencias.push({
                                codigo: totalPhotos > 1 ? `${cleanCode} (${photoIndex}/${totalPhotos})` : cleanCode,
                                descripcion: captionText,
                                foto: photoBuffer
                            });
                        }
                    }
                }
            }

            for (const ev of docEvidences) {
                if (ev.filename || ev.path) {
                    documentos.push({
                        nombre: ev.filename || path.basename(ev.path || 'Documento adjunto')
                    });
                }
            }

            const tieneDocumentos = documentos.length > 0;
            const enunciadoDocumentos = tieneDocumentos ? documentos.map(d => d.nombre).join(', ') : '';

            // Validar si ya contiene la referencia a la carpeta y anexo
            const hasAnnexRef = /carpeta\s*[\d.]*\s*anexo\s*[\d.]*/i.test(comment);
            if (!hasAnnexRef) {
                if (!comment.endsWith('.')) {
                    comment += '.';
                }
                comment += ` carpeta${cleanCode} Anexo ${actNum}.1.`;
            }

            const texto_actividad = `${actNum} ${comment}`;

            lista_actividades.push({
                num: actNum,
                codigo: cleanCode,
                texto: cleanOblText,
                encabezado_obligacion,
                texto_actividad,
                comentario: comment,
                fotos,
                tiene_fotos: fotos.length > 0,
                documentos,
                tiene_documentos: tieneDocumentos,
                enunciado_documentos: enunciadoDocumentos
            });
        }

        if (lista_actividades.length === 0) {
            lista_actividades.push({
                num: "1",
                codigo: "2.1",
                texto: "Ejecución de actividades contractuales",
                encabezado_obligacion: "2.1. Ejecución de actividades contractuales",
                texto_actividad: "1 No se registraron actividades en el periodo reportado. carpeta2.1 Anexo 1.1.",
                comentario: "No se registraron actividades en el periodo reportado.",
                fotos: [],
                tiene_fotos: false,
                documentos: [],
                tiene_documentos: false,
                enunciado_documentos: ""
            });
        }

        commonData.lista_actividades = lista_actividades;
        commonData.fotos_evidencias = fotos_evidencias;
        commonData.tiene_fotos_evidencias = fotos_evidencias.length > 0;

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

        // Asegurar que Anexos Descripción queden generados si no se ejecutó el flujo previo
        await ensureAnnexesGenerated();

        // Si fue el flujo de Secretaría TIC, subir todos los formatos oficiales, minuta, banco, planilla y comprobante a la carpeta DOCUMENTOS en Nextcloud
        if (shouldSendToNextcloud && nextcloudAccountPath) {
            try {
                console.log('📤 Subiendo documentos oficiales y anexos a la carpeta DOCUMENTOS en Nextcloud...');
                const docsToUpload = [
                    { localPath: generatedPaths.certificadoPath, destFileName: '1-CERTIFICADO DEL SUPERVISOR.docx' },
                    { localPath: generatedPaths.informePath, destFileName: '2-INFORME DE ACTIVIDADES.docx' },
                    { localPath: generatedPaths.estampillasPath, destFileName: '3-DESCUENTO DE ESTAMPILLAS.docx' },
                    { localPath: generatedPaths.retencionPath, destFileName: '4-RETENCION EN LA FUENTE.docx' }
                ];

                const extraContractDocs = [
                    { path: contract.actaInicioPath, defaultName: '5-ACTA DE INICIO' },
                    { path: contract.rpPath, defaultName: '6-REGISTRO PRESUPUESTAL' },
                    { path: contract.baseDocumentPath, defaultName: '7-MINUTA DEL CONTRATO' },
                    { path: contract.rutPath, defaultName: '8-RUT' },
                    { path: contract.bankCertificatePath, defaultName: '9-CERTIFICADO DE CUENTA BANCARIA' },
                    { path: period.securitySocialPath || contract.securitySocialPath, defaultName: '10-PLANILLA DE SEGURIDAD SOCIAL' },
                    { path: period.securitySocialReceiptPath, defaultName: '11-COMPROBANTE DE PAGO SEGURIDAD SOCIAL' }
                ];

                for (const extra of extraContractDocs) {
                    if (extra.path) {
                        try {
                            const buf = await storageService.getFileBuffer(extra.path);
                            if (buf) {
                                const ext = path.extname(extra.path) || '.pdf';
                                docsToUpload.push({
                                    buffer: buf,
                                    destFileName: `${extra.defaultName}${ext}`
                                });
                            }
                        } catch (e) {
                            console.warn(`Aviso al obtener buffer de ${extra.defaultName}:`, e.message);
                        }
                    }
                }

                await nextcloudService.uploadFinalDocumentsToNextcloud({
                    basePath: nextcloudBasePath,
                    contractorName: nextcloudContractorName,
                    contractNumber: nextcloudContractNumber,
                    accountNumber: period.actNumber,
                    documents: docsToUpload
                });
                console.log('✅ Documentos completos subidos a Nextcloud con éxito');
            } catch (upErr) {
                console.warn('⚠️ Error al subir documentos finales a Nextcloud:', upErr.message);
            }
        }

        period.markModified('activities');

        // ── Create ZIP ────────────────────────────────────────────
        const zipPath = await createBillingZip(period, contract, user);
        period.zipPath = zipPath;
        if (period.zipDriveId) {
            period.markModified('zipDriveId');
        }
        period.status  = 'pending'; // ready but not yet approved
        await period.save();

        return { period, contract, user, zipPath, generatedPaths, nextcloudUploaded: shouldSendToNextcloud };
};

exports.generateBillingPackage = generateBillingPackage;

// ──────────────────────────────────────────────────────────────
// POST /api/billing/:id/generate  →  Generate all 4 Word docs + ZIP
// ──────────────────────────────────────────────────────────────
exports.generatePackage = async (req, res) => {
    try {
        const { sendToNextcloud } = req.body || {};
        const { period, zipPath, nextcloudUploaded } = await generateBillingPackage(req.params.id, req.user._id, { sendToNextcloud });

        res.json({
            message: nextcloudUploaded ? 'Paquete generado y subido a Nextcloud NAS con éxito' : 'Paquete generado con éxito',
            zipUrl: `/generated/${path.basename(zipPath)}`,
            data: period,
            nextcloudUploaded
        });
    } catch (err) {
        console.error('Error generatePackage:', err);
        res.status(500).json({ message: 'Error al generar el paquete: ' + err.message, error: err.message });
    }
};

// ──────────────────────────────────────────────────────────────
// GET /api/billing/:id/download  →  Stream the ZIP to the browser
// ──────────────────────────────────────────────────────────────
exports.downloadPackage = async (req, res) => {
    try {
        const period = await BillingPeriod.findOne({ _id: req.params.id, user: req.user._id });
        if (!period) return res.status(404).json({ message: 'Periodo no encontrado' });

        const zipTarget = period.zipPath || period.zipDriveId;
        const zipBuffer = await storageService.getFileBuffer(zipTarget);
        if (!zipBuffer) {
            return res.status(404).json({ message: 'El paquete ZIP aún no ha sido generado. Por favor ejecute /generate primero.' });
        }

        // Mark period as zip downloaded
        period.zipDownloaded = true;
        period.zipDownloadedAt = new Date();
        await period.save();

        const fileName = path.basename(period.zipPath || `Cuenta_Cobro_Acta_${period.actNumber}.zip`);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Type', 'application/zip');
        res.send(zipBuffer);
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

// ──────────────────────────────────────────────────────────────
// POST /api/billing/upload-planilla  →  Process Planilla social PDF with Gemini
// ──────────────────────────────────────────────────────────────
exports.uploadPlanillaSocial = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba la planilla de seguridad social' });
        }

        const contractId = req.body.contractId || req.query.contractId;
        let contract = null;
        if (contractId) {
            contract = await Contract.findById(contractId);
        }
        if (!contract && req.user && req.user._id) {
            contract = await Contract.findOne({ user: req.user._id }).sort({ createdAt: -1 });
        }

        const user = await User.findById(req.user._id);
        const contractorFolder = `${contract?.idNumber || user?.cedula || req.user._id}_${(contract?.contractorName || user?.fullName || 'Contratista').replace(/[^a-zA-Z0-9]/g, '_')}`;
        const fileBuffer = req.file.buffer || (req.file.path && fs.existsSync(req.file.path) ? fs.readFileSync(req.file.path) : null);

        // Upload to Drive
        const uploaded = await storageService.saveFile({
            buffer: fileBuffer,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            pathSegments: ['Contratistas', contractorFolder, 'Planillas_Seguridad_Social']
        });

        // Gather candidate passwords: cédula from contract
        const candidates = [];
        if (contract && contract.idNumber) {
            candidates.push(contract.idNumber.trim());
            const cleanCedula = contract.idNumber.replace(/\D/g, '');
            if (cleanCedula && cleanCedula !== contract.idNumber.trim()) {
                candidates.push(cleanCedula);
            }
        }

        try {
            console.log("Procesando planilla de seguridad social con IA...");
            const extracted = await extractSecuritySocialData(fileBuffer, {
                filename: req.file.originalname,
                mimetype: req.file.mimetype,
                password: req.body.password,
                candidatePasswords: candidates
            });
            console.log("Datos de planilla extraídos:", extracted);

            let finalPath = uploaded.path;
            if (extracted?.cleanBuffer) {
                const cleanUploaded = await storageService.saveFile({
                    buffer: extracted.cleanBuffer,
                    filename: `Planilla_Social_Limpia_${Date.now()}.pdf`,
                    mimetype: 'application/pdf',
                    pathSegments: ['Contratistas', contractorFolder, 'Planillas_Seguridad_Social']
                });
                finalPath = cleanUploaded.path;
            }

            // Save filePath to user's contract if available
            if (contract) {
                contract.securitySocialPath = finalPath;
                await contract.save();
            } else if (req.user && req.user._id) {
                await Contract.findOneAndUpdate(
                    { user: req.user._id },
                    { securitySocialPath: finalPath }
                );
            }

            let message = 'Planilla procesada y respaldada en Google Drive con éxito';
            if (extracted.unlockedWithCedula) {
                message = 'Planilla de seguridad social desbloqueada automáticamente con tu cédula y procesada por la IA con éxito';
            } else if (extracted.unlockedWithPassword) {
                message = 'Planilla de seguridad social desbloqueada con la contraseña ingresada y procesada por la IA con éxito';
            }

            return res.json({
                message,
                data: extracted,
                filePath: finalPath,
                unlockedWithCedula: extracted.unlockedWithCedula,
                unlockedWithPassword: extracted.unlockedWithPassword
            });
        } catch (err) {
            if (err.code === 'PASSWORD_REQUIRED') {
                if (contract) {
                    contract.securitySocialPath = uploaded.path;
                    await contract.save();
                } else if (req.user && req.user._id) {
                    await Contract.findOneAndUpdate(
                        { user: req.user._id },
                        { securitySocialPath: uploaded.path }
                    );
                }

                return res.status(200).json({
                    requiresPassword: true,
                    docType: 'securitySocial',
                    invalidPassword: Boolean(req.body.password),
                    message: req.body.password
                        ? "La contraseña ingresada es incorrecta para la planilla de seguridad social."
                        : (candidates.length > 0
                            ? "La planilla de seguridad social está protegida con contraseña. Intentamos abrirla automáticamente con tu número de cédula pero no coincidió. Por favor ingresa la contraseña para procesarla con la IA."
                            : "La planilla de seguridad social está protegida con contraseña. Por favor ingresa la contraseña para procesarla con la IA."),
                    filePath: uploaded.path
                });
            }
            throw err;
        }
    } catch (error) {
        console.error('Error uploadPlanillaSocial:', error);
        res.status(500).json({ message: 'Error al procesar la planilla de seguridad social', error: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// POST /api/billing/unlock-planilla  →  Unlock previously uploaded planilla with password
// ──────────────────────────────────────────────────────────────
exports.unlockPlanillaSocial = async (req, res) => {
    try {
        const { password, contractId, filePath } = req.body;
        if (!password || !password.trim()) {
            return res.status(400).json({ message: 'Por favor ingresa la contraseña de la planilla de seguridad social' });
        }

        let targetPath = filePath;
        let contract = null;
        if (contractId) {
            contract = await Contract.findById(contractId);
        }
        if (!contract && req.user && req.user._id) {
            contract = await Contract.findOne({ user: req.user._id }).sort({ createdAt: -1 });
        }
        if (!targetPath && contract) {
            targetPath = contract.securitySocialPath;
        }

        const fileBuffer = await storageService.getFileBuffer(targetPath);
        if (!fileBuffer) {
            return res.status(404).json({ message: 'El archivo de la planilla no fue encontrado. Por favor vuelve a subirlo.' });
        }

        try {
            console.log("Intentando desbloquear planilla de seguridad social con contraseña ingresada...");
            const extracted = await extractSecuritySocialData(fileBuffer, {
                password: password.trim(),
                candidatePasswords: []
            });

            let finalPath = targetPath;
            if (extracted?.cleanBuffer) {
                const user = await User.findById(req.user._id);
                const contractorFolder = `${contract?.idNumber || user?.cedula || req.user._id}_${(contract?.contractorName || user?.fullName || 'Contratista').replace(/[^a-zA-Z0-9]/g, '_')}`;
                const cleanUploaded = await storageService.saveFile({
                    buffer: extracted.cleanBuffer,
                    filename: `Planilla_Social_Limpia_${Date.now()}.pdf`,
                    mimetype: 'application/pdf',
                    pathSegments: ['Contratistas', contractorFolder, 'Planillas_Seguridad_Social']
                });
                finalPath = cleanUploaded.path;
            }

            if (contract) {
                contract.securitySocialPath = finalPath;
                await contract.save();
            }

            return res.json({
                success: true,
                message: '¡Planilla de seguridad social desbloqueada y procesada por IA con éxito!',
                data: extracted,
                filePath: finalPath
            });
        } catch (err) {
            if (err.code === 'PASSWORD_REQUIRED') {
                return res.status(400).json({
                    requiresPassword: true,
                    docType: 'securitySocial',
                    invalidPassword: true,
                    message: 'Contraseña incorrecta. Por favor verifica e intenta nuevamente.'
                });
            }
            return res.status(500).json({
                message: 'Error al procesar la planilla con IA: ' + err.message
            });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error al desbloquear planilla de seguridad social', error: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// POST /api/billing/improve-evidence-text  →  Enrich evidence text with Gemini (30-50 words)
// ──────────────────────────────────────────────────────────────
exports.improveEvidenceText = async (req, res) => {
    try {
        const { rawText, obligationText } = req.body;
        if (!rawText || !rawText.trim()) {
            return res.status(400).json({ message: 'El texto base de la evidencia es requerido' });
        }

        const contractorName = req.user ? req.user.name : '';
        const improved = await improveEvidenceText({
            rawText,
            obligationText,
            contractorName
        });

        res.json({
            originalText: rawText,
            improvedText: improved
        });
    } catch (error) {
        console.error('Error improveEvidenceText controller:', error);
        res.status(500).json({ message: 'Error al mejorar el texto con IA', error: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// GET /api/billing/:id/annex/:code  →  Download single Anexo Descripcion
// ──────────────────────────────────────────────────────────────
exports.downloadAnnexDocument = async (req, res) => {
    try {
        const period = await BillingPeriod.findOne({ _id: req.params.id, user: req.user._id });
        if (!period) return res.status(404).json({ message: 'Periodo no encontrado' });

        const targetCode = decodeURIComponent(req.params.code).trim();
        const act = (period.activities || []).find(a => 
            (a.obligationCode && a.obligationCode.trim() === targetCode) ||
            (a.obligationCode && a.obligationCode.replace(/[^a-zA-Z0-9.-]/g, '_') === targetCode)
        );

        if (!act || (!act.annexDocPath && !act.annexDriveId)) {
            return res.status(404).json({ message: `No se encontró el Anexo Descripción para la obligación ${targetCode}` });
        }

        const annexTarget = act.annexDocPath || act.annexDriveId;
        const fileBuffer = await storageService.getFileBuffer(annexTarget);
        if (!fileBuffer) {
            return res.status(404).json({ message: 'No se pudo cargar el archivo del anexo solicitado' });
        }

        const fileName = `Anexo Descripcion ${targetCode}.docx`;
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(fileBuffer);
    } catch (err) {
        res.status(500).json({ message: 'Error al descargar el anexo', error: err.message });
    }
};

// ──────────────────────────────────────────────────────────────
// POST /api/billing/upload-comprobante-ss  →  Upload payment receipt of planilla
// ──────────────────────────────────────────────────────────────
exports.uploadComprobanteSocial = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba el comprobante de pago de la planilla' });
        }

        const contractId = req.body.contractId || req.query.contractId;
        let contract = null;
        if (contractId) {
            contract = await Contract.findById(contractId);
        }
        if (!contract && req.user && req.user._id) {
            contract = await Contract.findOne({ user: req.user._id }).sort({ createdAt: -1 });
        }

        const user = await User.findById(req.user._id);
        const contractorFolder = `${contract?.idNumber || user?.cedula || req.user._id}_${(contract?.contractorName || user?.fullName || 'Contratista').replace(/[^a-zA-Z0-9]/g, '_')}`;
        const fileBuffer = req.file.buffer || (req.file.path && fs.existsSync(req.file.path) ? fs.readFileSync(req.file.path) : null);

        const uploaded = await storageService.saveFile({
            buffer: fileBuffer,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            pathSegments: ['Contratistas', contractorFolder, 'Comprobantes_Pago_SS']
        });

        res.json({
            message: 'Comprobante de pago de planilla subido con éxito',
            filePath: uploaded.path,
            filename: req.file.originalname
        });
    } catch (err) {
        console.error('Error uploadComprobanteSocial:', err);
        res.status(500).json({ message: 'Error al subir comprobante de pago', error: err.message });
    }
};




const path = require('path');
const fs   = require('fs');
const BillingPeriod   = require('../models/BillingPeriod');
const Contract        = require('../models/Contract');
const User            = require('../models/User');
const { generateDocument } = require('../services/document.service');
const { createBillingZip } = require('../services/archive.service');
const { extractSecuritySocialData, improveEvidenceText } = require('../services/gemini.service');

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
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [y, m, d] = dateInput.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
}

function formatDateEs(dateInput) {
    const d = parseDateSafe(dateInput);
    if (!d) return '';
    return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}
function monthYearEs(dateInput) {
    const d = parseDateSafe(dateInput) || new Date();
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

        // Forma de pago formatted description
        const formaPagoText = contract.paymentMethod
            ? (contract.paymentMethod.toLowerCase().includes('cuenta')
                ? `${contract.paymentMethod} No. ${contract.accountNumber || ''}`
                : `Transferencia Cuenta ${contract.paymentMethod} No. ${contract.accountNumber || ''}`)
            : (contract.accountNumber ? `Transferencia Cuenta No. ${contract.accountNumber}` : 'Transferencia Electrónica');

        // Formatted currency strings
        const totalValFormatted = Number(contract.totalValue || 0).toLocaleString('es-CO');
        const monthlyValFormatted = Number(contract.monthlyValue || 0).toLocaleString('es-CO');
        const remainingValFormatted = remainingVal.toLocaleString('es-CO');
        const saludValFormatted = Number(period.securitySocial?.saludPaid || 0).toLocaleString('es-CO');
        const pensionValFormatted = Number(period.securitySocial?.pensionPaid || 0).toLocaleString('es-CO');
        const arlValFormatted = Number(period.securitySocial?.arlPaid || 0).toLocaleString('es-CO');
        const ssTotalFormatted = Number(period.securitySocial?.totalPaid || 0).toLocaleString('es-CO');

        // Tax / Retención options
        const takesCosts = !!contract.takesCosts;
        const takesExemptRent = contract.takesExemptRent !== false;
        const isTaxFiler = !!contract.isTaxFiler;
        const previousTaxYear = (parseInt(anio, 10) - 1).toString();

        const commonData = {
            // ── NUEVAS VARIABLES (snake_case) para CERTIFICADO DEL SUPERVISOR ──
            fecha_certificado:                 formatDateEs(period.periodTo),
            nombre_supervisor:                 contract.supervisorName || '',
            dependencia:                       contract.supervisorDependency || 'Secretaría de Planeación',
            nombre_contratista:                contract.contractorName || user.fullName || '',
            identificacion_contratista:        contract.idNumber || '',
            tipo_contrato:                     contract.contractType || 'Prestación de Servicios Profesionales',
            numero_contrato:                   contract.contractNumber || '',
            fecha_acta_inicio:                 contract.startDate ? formatDateEs(contract.startDate) : '',
            fecha_terminacion:                 contract.endDate ? formatDateEs(contract.endDate) : '',
            cdp:                               contract.cdp || '',
            rp:                                contract.rp || '',
            rubro_presupuestal:                contract.rubro || '',
            valor_total:                       totalValFormatted,
            entidad_bancaria:                  contract.bankName || '',
            valor_autorizado_pago:             monthlyValFormatted,
            numero_cuenta:                     contract.accountNumber || '',
            saldo_restante:                    remainingValFormatted,
            forma_pago:                        formaPagoText,
            periodo_pagar_inicio:              formatDateEs(period.periodFrom),
            periodo_pagar_fin:                 formatDateEs(period.periodTo),
            mes_planilla:                      period.securitySocial?.period || mes,
            numero_planilla:                   period.securitySocial?.planillaNumber || '',
            valor_pension:                     pensionValFormatted,
            valor_salud:                       saludValFormatted,
            valor_arl:                         arlValFormatted,
            valor_pago_certificado:            monthlyValFormatted,
            soporte_acta_inicio_folios:        period.actNumber === 1 ? "1" : "0",
            soporte_informe_contratista_folios: "2",
            soporte_informe_supervisor_folios:  "1",
            soportes_otros:                    "Planilla de Seguridad Social, RUT, Certificación Bancaria",
            chk_anticipo:                      "[   ]",
            chk_primero:                       period.actNumber === 1 ? "[ X ]" : "[   ]",
            chk_segundo:                       period.actNumber === 2 ? "[ X ]" : "[   ]",
            chk_tercero:                       period.actNumber === 3 ? "[ X ]" : "[   ]",
            chk_cuarto:                        period.actNumber === 4 ? "[ X ]" : "[   ]",
            chk_quinto:                        period.actNumber === 5 ? "[ X ]" : "[   ]",
            chk_sexto:                         period.actNumber === 6 ? "[ X ]" : "[   ]",
            chk_septimo:                       period.actNumber === 7 ? "[ X ]" : "[   ]",
            chk_octavo:                        period.actNumber === 8 ? "[ X ]" : "[   ]",
            chk_noveno:                        period.actNumber === 9 ? "[ X ]" : "[   ]",
            chk_otros:                         period.actNumber > 9 ? "[ X ]" : "[   ]",
            otros_cual:                        period.actNumber > 9 ? (ACT_TEXTS[period.actNumber] || `PAGO ${period.actNumber}`) : "",

            // ── NUEVAS VARIABLES (snake_case) para DESCUENTO DE ESTAMPILLAS ──
            ciudad_fecha:                      `Armenia, ${formatDateEs(period.periodTo)}`,
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
            lugar_expedicion_cc:               contract.idCity || 'Armenia',

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
            supervisorDependency: contract.supervisorDependency || 'Secretaría de Planeación',
            contractorAddress: contract.contractorAddress || '',
            contractorPhone:   contract.contractorPhone   || '',
            startDate:        contract.startDate ? formatDateEs(contract.startDate) : '',
            endDate:          contract.endDate ? formatDateEs(contract.endDate) : '',
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
            rpNumber:         contract.rp                 || '',
            cdpNumber:        contract.cdp                || '',
            rubro:            contract.rubro              || '',
            actNumber:        period.actNumber.toString(),
            periodFrom:       formatDateEs(period.periodFrom),
            periodTo:         formatDateEs(period.periodTo),
            mes,
            anio,
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
            periodToDate:     formatDateEs(period.periodTo),
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

// ──────────────────────────────────────────────────────────────
// POST /api/billing/upload-planilla  →  Process Planilla social PDF with Gemini
// ──────────────────────────────────────────────────────────────
exports.uploadPlanillaSocial = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba la planilla de seguridad social' });
        }

        console.log("Procesando planilla de seguridad social con IA...");
        const extracted = await extractSecuritySocialData(req.file.path);
        console.log("Datos de planilla extraídos:", extracted);

        res.json({
            message: 'Planilla procesada con éxito por la IA',
            data: extracted
        });
    } catch (error) {
        console.error('Error uploadPlanillaSocial:', error);
        res.status(500).json({ message: 'Error al procesar la planilla de seguridad social', error: error.message });
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


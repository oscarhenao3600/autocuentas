const mongoose = require('mongoose');
require('dotenv').config();
const { generateDocument } = require('../services/document.service');
const BillingPeriod = require('../models/BillingPeriod');
const Contract = require('../models/Contract');
const User = require('../models/User');
const PizZip = require('pizzip');
const fs = require('fs');

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

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27019/formatos_cuentas';
async function test() {
    await mongoose.connect(MONGODB_URI);
    const period = await BillingPeriod.findOne().sort({ updatedAt: -1 });
    const contract = await Contract.findById(period.contract);
    const user = await User.findById(period.user);

    console.log('Inicio:', formatDateEs(contract.startDate));
    console.log('Fin:', formatDateEs(contract.endDate));

    const commonData = {
        fecha_acta_inicio: formatDateEs(contract.startDate),
        fecha_terminacion: formatDateEs(contract.endDate),
        nombre_contratista: contract.contractorName,
        numero_contrato: contract.contractNumber,
        objeto_contrato: contract.contractObject,
        plazo_ejecucion: contract.executionTerm,
        acta_parcial_anio: '2026',
        acta_parcial_mes: '09',
        acta_parcial_dia: '27',
        numero_acta_parcial: '1',
        periodo_informado_inicio: '27 - 09 - 2026',
        periodo_informado_fin: '27 - 10 - 2026',
        actividades_desarrolladas: 'Prueba de actividades',
        evidencias_ejecucion: 'Prueba de evidencias',
        anticipo: '0',
        valor_acta_1: '3.000.000',
        valor_acta_2: '0',
        valor_acta_3: '0',
        valor_acta_n: '0',
        saldo_pendiente: '8.500.000',
        otros_contratos_si: '[   ]',
        otros_contratos_no: '[ X ]',
        valor_ingresos_mensualizados: '3.000.000',
        valor_ibc: '1.423.500',
        entidad_pago_aportes: period.securitySocial.operator || 'SIMPLE',
        valor_total_aporte: Number(period.securitySocial.totalPaid).toLocaleString('es-CO'),
        numero_recibo_aportes: period.securitySocial.planillaNumber || '',
        periodo_cotizado_inicio: '27 - 09 - 2026',
        periodo_cotizado_fin: '27 - 10 - 2026',
        chk_recibo_pago_ss: '[ X ]',
        chk_copias_planillas: '[ X ]',
        chk_anexos_otros: '[   ]',
        observaciones: 'NINGUNA',
        valor_pension: Number(period.securitySocial.pensionPaid).toLocaleString('es-CO'),
        valor_salud: Number(period.securitySocial.saludPaid).toLocaleString('es-CO'),
        valor_arl: Number(period.securitySocial.arlPaid).toLocaleString('es-CO'),
        valor_total: '11.500.000',
        nombre_supervisor: contract.supervisorName,
        forma_pago: 'Transferencia Cuenta Ahorros No. 86772529386',
        rp: contract.rp
    };

    const result = await generateDocument('FORMATO INFORME DE ACTIVIDADES.docx', commonData);
    console.log('Document successfully generated at:', result.outputPath);

    // Read back generated xml to verify filled values
    const generatedZip = new PizZip(fs.readFileSync(result.outputPath, 'binary'));
    const xml = generatedZip.file('word/document.xml').asText();
    const snippet1 = xml.match(/.{0,30}Fecha de Inicio.{0,100}/g);
    const snippet2 = xml.match(/.{0,30}Fecha de terminación.{0,100}/g);
    const snippet3 = xml.match(/.{0,30}APORTES AL SISTEMA.{0,500}/g);
    console.log('Snippet Inicio:', snippet1 ? snippet1[0].replace(/<[^>]+>/g, ' ') : 'N/A');
    console.log('Snippet Fin:', snippet2 ? snippet2[0].replace(/<[^>]+>/g, ' ') : 'N/A');
    console.log('Snippet Aportes:', snippet3 ? snippet3[0].replace(/<[^>]+>/g, ' ') : 'N/A');

    await mongoose.disconnect();
}

test().catch(console.error);

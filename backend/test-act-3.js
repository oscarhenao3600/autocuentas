const path = require('path');
const fs = require('fs');
const { generateDocument } = require('./services/document.service');

// Mock data exactly matching billing.controller.js formatting
const contract = {
    contractorName: "JUAN PEREZ SANCHEZ",
    idNumber: "1.094.123.456",
    contractNumber: "003-2026",
    contractType: "Prestacion de Servicios",
    contractObject: "Prestacion de servicios profesionales para el desarrollo e implementacion del bot de Telegram en el sistema FormatosCuentas",
    supervisorName: "ING. CARLOS GOMEZ - SUPERVISOR DE T.I.",
    supervisorDependency: "Secretaría de Planeación",
    contractorAddress: "Carrera 18 # 2-75 Ed Las Terrazas Apto 301",
    contractorPhone: "3113414361",
    startDate: "2026-03-01",
    endDate: "2026-07-01",
    totalValue: "18000000",
    totalValueWord: "DIECIOCHO MILLONES DE PESOS M/CTE",
    monthlyValue: "4500000",
    monthlyValueWord: "CUATRO MILLONES QUINIENTOS MIL PESOS M/CTE",
    rp: "12345",
    cdp: "67890",
    rubro: "SERVICIOS PROFESIONALES DE APOYO A LA GESTION",
    bankName: "BANCOLOMBIA",
    accountNumber: "987-654321-09",
    paymentMethod: "Ahorros",
    activities: [
        "Desarrollar y configurar el modulo del bot de Telegram.",
        "Implementar la base de datos de evidencias y comentarios.",
        "Realizar pruebas de integracion con el panel web y docker."
    ]
};

const period = {
    actNumber: 3,
    periodFrom: new Date("2026-05-01T00:00:00"),
    periodTo: new Date("2026-05-30T23:59:59"),
    status: "pending",
    securitySocial: {
        operator: "SIMPLE",
        planillaNumber: "889912345",
        totalPaid: 585200,
        saludPaid: 180000,
        pensionPaid: 240000,
        arlPaid: 25200,
        period: "Mayo 2026"
    },
    activities: [
        {
            obligationCode: "2.1",
            obligationText: "Desarrollar y configurar el modulo del bot de Telegram.",
            comment: "Se completo el desarrollo del bot de Telegram con teclados interactivos y carga de archivos.",
            evidences: [{ filename: "evidencia_bot.png", path: "uploads/test-bot.png", mimetype: "image/png" }]
        },
        {
            obligationCode: "2.2",
            obligationText: "Implementar la base de datos de evidencias y comentarios.",
            comment: "Se integro la base de datos MongoDB para almacenar las rutas de los archivos cargados.",
            evidences: [{ filename: "evidencia_db.pdf", path: "uploads/test-db.pdf", mimetype: "application/pdf" }]
        },
        {
            obligationCode: "2.3",
            obligationText: "Realizar pruebas de integracion con el panel web y docker.",
            comment: "Se verificaron las pruebas de ejecucion local y de docker-compose.",
            evidences: []
        }
    ]
};

// Calculations as in billing.controller.js
const SMMLV = 1423500; // SMMLV 2025/2026
const monthlyVal = parseFloat(contract.monthlyValue) || 0;
const forty = Math.round(monthlyVal * 0.4);
const ibc = Math.max(forty, SMMLV);

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

const { mes, anio } = monthYearEs(period.periodTo);

// Calculate remaining balance
const totalVal = parseFloat(contract.totalValue) || 0;
const usedValue = (period.actNumber) * monthlyVal;
const remainingVal = Math.max(0, totalVal - usedValue);

// Map act number to text in Spanish
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

const contractTypeClean = (contract.contractType || '').toLowerCase();
const isApoyo = contractTypeClean.includes('apoyo') || contractTypeClean.includes('gesti');
const isProfesional = contractTypeClean.includes('profesional') || (!isApoyo && contractTypeClean.includes('servicios'));
const isObra = contractTypeClean.includes('obra');
const isConsultoria = contractTypeClean.includes('consultor');
const isCompraventa = contractTypeClean.includes('compra') || contractTypeClean.includes('suministro');
const isProveedor = contractTypeClean.includes('proveedor');
const isOtro = !isApoyo && !isProfesional && !isObra && !isConsultoria && !isCompraventa && !isProveedor;

const chkApoyo = isApoyo ? "[ X ]" : "[   ]";
const chkProfesional = isProfesional ? "[ X ]" : "[   ]";
const chkObra = isObra ? "[ X ]" : "[   ]";
const chkConsultoria = isConsultoria ? "[ X ]" : "[   ]";
const chkSuministros = isCompraventa ? "[ X ]" : "[   ]";
const chkProveedor = isProveedor ? "[ X ]" : "[   ]";
const chkOtro = isOtro ? "[ X ]" : "[   ]";

const formaPagoText = contract.paymentMethod
    ? (contract.paymentMethod.toLowerCase().includes('cuenta')
        ? `${contract.paymentMethod} No. ${contract.accountNumber || ''}`
        : `Transferencia Cuenta ${contract.paymentMethod} No. ${contract.accountNumber || ''}`)
    : (contract.accountNumber ? `Transferencia Cuenta No. ${contract.accountNumber}` : 'Transferencia Electrónica');

const totalValFormatted = Number(contract.totalValue || 0).toLocaleString('es-CO');
const monthlyValFormatted = Number(contract.monthlyValue || 0).toLocaleString('es-CO');
const remainingValFormatted = remainingVal.toLocaleString('es-CO');
const saludValFormatted = Number(period.securitySocial?.saludPaid || 0).toLocaleString('es-CO');
const pensionValFormatted = Number(period.securitySocial?.pensionPaid || 0).toLocaleString('es-CO');
const arlValFormatted = Number(period.securitySocial?.arlPaid || 0).toLocaleString('es-CO');
const ssTotalFormatted = Number(period.securitySocial?.totalPaid || 0).toLocaleString('es-CO');

const commonData = {
    // ── NUEVAS VARIABLES (snake_case) para CERTIFICADO DEL SUPERVISOR ──
    fecha_certificado:                 formatDateEs(period.periodTo),
    nombre_supervisor:                 contract.supervisorName || '',
    dependencia:                       contract.supervisorDependency || 'Secretaría de Planeación',
    nombre_contratista:                contract.contractorName || '',
    identificacion_contratista:        contract.idNumber || '',
    tipo_contrato:                     contract.contractType || 'Prestación de Servicios Profesionales',
    numero_contrato:                   contract.contractNumber || '',
    fecha_acta_inicio:                 formatDateEs(period.periodFrom),
    fecha_terminacion:                 formatDateEs(period.periodTo),
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
    firma_contratista:                 contract.contractorName || '',
    lugar_expedicion_cc:               'Armenia',

    // ── NUEVAS VARIABLES (snake_case) para RETENCION EN LA FUENTE ──
    mes_documento:                     mes.toLowerCase(),
    anio_documento:                    anio,
    valor_a_pagar_acta_actual:         monthlyValFormatted,
    chk_costos_deducciones_no:         "[ X ]",
    chk_costos_deducciones_si:         "[   ]",
    chk_renta_exenta_si:               "[ X ]",
    chk_renta_exenta_no:               "[   ]",
    anio_vigencia_anterior:            (parseInt(anio, 10) - 1).toString(),
    chk_declarante_renta_si:           "[   ]",
    chk_declarante_renta_no:           "[ X ]",
    correo_contratista:                'juan.perez@example.com',

    // ── VARIABLES LEGACY (camelCase) ──
    contractorName:   contract.contractorName,
    idNumber:         contract.idNumber,
    contractNumber:   contract.contractNumber,
    contractType:     contract.contractType,
    contractObject:   contract.contractObject,
    supervisorName:   contract.supervisorName,
    supervisorDependency: contract.supervisorDependency,
    startDate:        formatDateEs(period.periodFrom),
    endDate:          formatDateEs(period.periodTo),
    totalValue:       totalValFormatted,
    totalValueWord:   contract.totalValueWord,
    monthlyValue:     monthlyValFormatted,
    monthlyValueWord: contract.monthlyValueWord,
    ibcValue:         ibc.toLocaleString('es-CO'),
    rpNumber:         contract.rp,
    cdpNumber:        contract.cdp,
    rp:               contract.rp,
    cdp:              contract.cdp,
    rubro:            contract.rubro,
    actNumber:        period.actNumber.toString(),
    periodFrom:       formatDateEs(period.periodFrom),
    periodTo:         formatDateEs(period.periodTo),
    mes,
    anio,
    hasAddition:       false,
    additionValue:     "0",
    additionValueWord: "",
    additionStartDate: "",
    additionEndDate:   "",
    additionCdp:       "",
    additionRp:        "",
    additionRubro:     "",
    additionDuration:  "",
    totalValueWithAddition: totalValFormatted,
    totalValueWithAdditionWord: contract.totalValueWord,
    ssOperator:       period.securitySocial.operator,
    ssPlanilla:       period.securitySocial.planillaNumber,
    ssTotalPaid:      ssTotalFormatted,
    ssSalud:          saludValFormatted,
    ssPension:        pensionValFormatted,
    ssArl:            arlValFormatted,
    ssPeriod:         period.securitySocial.period || mes,
    bankName:         contract.bankName,
    accountNumber:    contract.accountNumber,
    paymentMethod:    contract.paymentMethod,
    periodToDate:     formatDateEs(period.periodTo),
    remainingValue:   remainingValFormatted,
    foliosContratista: "2",
    foliosSupervisor:  "1",
    actNumberText:     ACT_TEXTS[period.actNumber] || `${period.actNumber} PAGO`,
    contractorAddress: contract.contractorAddress,
    contractorPhone:   contract.contractorPhone,
    periodMonthYear:   `${mes.charAt(0) + mes.slice(1).toLowerCase()} ${anio}`,
    chkApoyo,
    chkProfesional,
    chkObra,
    chkConsultoria,
    chkSuministros,
    chkProveedor,
    chkOtro,

    activities: period.activities.map((act, i) => ({
        num:             (i + 1).toString(),
        obligationCode:  act.obligationCode,
        obligationText:  act.obligationText,
        comment:         act.comment
    }))
};

async function testGeneration() {
    console.log("=== PRUEBA DE GENERACION DE DOCUMENTOS (ACTA 3) ===");
    console.log(`Contratista: ${commonData.contractorName}`);
    console.log(`Acta N: ${commonData.actNumber}`);
    
    // Check templates and handle names
    const templates = [
        { name: 'FORMATO CERTIFICADO DEL SUPERVISOR.docx',  key: 'certificadoPath' },
        { name: 'FORMATO INFORME DE ACTIVIDADES.docx',      key: 'informePath' },
        { name: 'FORMATO DESCUENTO DE ESTAMPILLAS.docx',    key: 'estampillasPath' },
        { name: 'FORMATO RETENCION EN LA FUENTE.docx',      key: 'retencionPath' }
    ];

    const templatesPath = path.resolve(__dirname, 'templates');
    const estampillasDocxExists = fs.existsSync(path.join(templatesPath, 'FORMATO DESCUENTO DE ESTAMPILLAS.docx'));
    if (!estampillasDocxExists) {
        console.log("ℹ️ FORMATO DESCUENTO DE ESTAMPILLAS.docx no encontrado. Usando version .doc");
        templates[2].name = 'FORMATO DESCUENTO DE ESTAMPILLAS.doc';
    }

    for (const tpl of templates) {
        try {
            console.log(`Generando: ${tpl.name}...`);
            const result = await generateDocument(tpl.name, commonData);
            console.log(`✅ Exito! Generado en: ${result.outputPath}`);
        } catch (err) {
            console.error(`❌ Error en ${tpl.name}:`, err.message);
        }
    }
}

testGeneration();

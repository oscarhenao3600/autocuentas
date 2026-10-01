const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

const { generateDocument } = require('../services/document.service');
const { calculateSocialSecurity } = require('../utils/period.utils');
const { getFormatNameForDependency } = require('../utils/secretariasDictionary');
const { createBillingZip } = require('../services/archive.service');
const PizZip = require('pizzip');

async function testCompleteGeneration() {
    console.log('🚀 Starting end-to-end generation audit for Cuenta 1 and Cuenta 2...\n');

    const contract = {
        _id: new mongoose.Types.ObjectId(),
        contractNumber: 'CO1.PCCNTR.9868346 ( TIC-CD-2026-092 )',
        contractType: 'PRESTACIÓN DE SERVICIOS DE APOYO A LA GESTION',
        contractObject: 'PRESTACIÓN DE SERVICIOS DE APOYO A LA GESTIÓN EN LA SECRETARÍA DE LAS TECNOLOGÍAS DE LA INFORMACIÓN Y LAS COMUNICACIONES',
        contractorName: 'Oscar Alexander Henao Hernandez',
        idNumber: '9774679',
        idCity: 'Armenia',
        contractorAddress: 'carrera 18#2-75',
        contractorPhone: '3113414361',
        contractorEmail: 'oscarhenao3600@gmail.com',
        supervisorName: 'ANDRES FELIPE BARRERA PEREZ',
        supervisorDependency: 'SECRETARIA TIC - 11401',
        startDate: '2026-08-28',
        endDate: '2026-12-20',
        totalValue: 11500000,
        monthlyValue: 3000000,
        bankName: 'BANCOLOMBIA',
        accountNumber: '86772529386',
        paymentMethod: 'Transferencia Cuenta Ahorros',
        cdp: '6788',
        rp: '07659',
        rubro: '2.3.2.02.02.009.4599007.077 - 001',
        executionTerm: '115 DÍAS CALENDARIO',
        takesCosts: false,
        takesExemptRent: false,
        isTaxFiler: false
    };

    const user = {
        _id: new mongoose.Types.ObjectId(),
        fullName: 'Oscar Alexander Henao Hernandez',
        cedula: '9774679',
        email: 'oscarhenao3600@gmail.com'
    };

    // ─────────────────────────────────────────────────────────────
    // TEST 1: CUENTA 1 (Acta 1 - Proporcional 3 días en PILA)
    // ─────────────────────────────────────────────────────────────
    console.log('====================================================');
    console.log('📄 TESTING CUENTA 1 (Acta 1 - Proporcional)');
    console.log('====================================================');

    const period1 = {
        _id: new mongoose.Types.ObjectId(),
        actNumber: 1,
        periodFrom: '2026-08-28',
        periodTo: '2026-09-26',
        securitySocial: {
            operator: 'SIMPLE',
            planillaNumber: '1085439710',
            ibc: 175091,
            days: 3,
            saludPaid: 21900,
            pensionPaid: 28100,
            arlPaid: 1000,
            totalPaid: 51000,
            period: 'Agosto de 2026',
            periodCotizadoInicio: '28 - 08 - 2026',
            periodCotizadoFin: '30 - 08 - 2026'
        },
        activities: [
            {
                obligationCode: '2.2.1',
                obligationText: 'Apoyar el mantenimiento preventivo y correctivo de la infraestructura tecnológica.',
                comment: 'Se realizó soporte técnico continuo a los equipos de cómputo.',
                evidences: []
            },
            {
                obligationCode: '2.2.2',
                obligationText: 'Brindar asistencia técnica a las diferentes dependencias de la entidad.',
                comment: 'Se atendieron solicitudes de soporte de diversas secretarías.',
                evidences: []
            }
        ]
    };

    const ssCalc1 = calculateSocialSecurity(contract, period1, period1.securitySocial);
    console.log('✅ SS Calc 1 (uploaded priority):', {
        ibc: ssCalc1.ibc,
        pension: ssCalc1.pensionPaid,
        salud: ssCalc1.saludPaid,
        arl: ssCalc1.arlPaid,
        total: ssCalc1.totalPaid
    });

    const commonData1 = {
        fecha_certificado: '30 - 09 - 2026',
        nombre_supervisor: contract.supervisorName,
        dependencia: getFormatNameForDependency(contract.supervisorDependency),
        nombre_contratista: contract.contractorName,
        identificacion_contratista: contract.idNumber,
        tipo_contrato: contract.contractType,
        numero_contrato: contract.contractNumber,
        fecha_acta_inicio: '28 de Agosto de 2026',
        fecha_terminacion: '20 de Diciembre de 2026',
        cdp: contract.cdp,
        rp: contract.rp,
        rubro_presupuestal: contract.rubro,
        valor_total: '11.500.000',
        entidad_bancaria: contract.bankName,
        valor_autorizado_pago: '3.000.000',
        numero_cuenta: contract.accountNumber,
        saldo_restante: '8.500.000',
        forma_pago: `${contract.paymentMethod} No. ${contract.accountNumber}`,
        periodo_pagar_inicio: '28 - 08 - 2026',
        periodo_pagar_fin: '26 - 09 - 2026',
        mes_planilla: ssCalc1.period,
        numero_planilla: ssCalc1.planillaNumber,
        valor_pension: Number(ssCalc1.pensionPaid).toLocaleString('es-CO'),
        valor_salud: Number(ssCalc1.saludPaid).toLocaleString('es-CO'),
        valor_arl: Number(ssCalc1.arlPaid).toLocaleString('es-CO'),
        valor_pago_certificado: '3.000.000',
        soporte_acta_inicio_folios: "1",
        soporte_informe_contratista_folios: "2",
        soporte_informe_supervisor_folios: "1",
        soporte_planilla_folios: "1",
        soporte_recibo_folios: "1",
        chk_anticipo: "___",
        chk_primero: "_ X _",
        chk_segundo: "___",
        chk_tercero: "___",
        chk_cuarto: "___",
        chk_quinto: "___",
        chk_sexto: "___",
        chk_septimo: "___",
        chk_octavo: "___",
        chk_noveno: "___",
        chk_otros: "___",
        otros_cual: "",

        objeto_contrato: contract.contractObject,
        plazo_ejecucion: contract.executionTerm,
        acta_parcial_anio: '2026',
        acta_parcial_mes: '09',
        acta_parcial_dia: '30',
        numero_acta_parcial: '1',
        periodo_informado_inicio: '28 - 08 - 2026',
        periodo_informado_fin: '26 - 09 - 2026',
        actividades_desarrolladas: '2.2.1 Apoyar el mantenimiento preventivo y correctivo.\n1 Se realizó soporte técnico continuo. carpeta2.2.1 Anexo 1.1.\n\n2.2.2 Brindar asistencia técnica.\n2 Se atendieron solicitudes de soporte. carpeta2.2.2 Anexo 2.1.',
        evidencias_ejecucion: 'Documentos oficiales y soportes anexos en carpetas estructuradas.',
        anticipo: '0',
        valor_acta_1: '3.000.000',
        valor_acta_2: '0',
        valor_acta_3: '0',
        valor_acta_n: '0',
        saldo_pendiente: '8.500.000',
        otros_contratos_si: '[   ]',
        otros_contratos_no: '[ X ]',
        valor_ingresos_mensualizados: '3.000.000',
        valor_ibc: Number(ssCalc1.ibc).toLocaleString('es-CO'),
        entidad_pago_aportes: ssCalc1.operator,
        valor_total_aporte: Number(ssCalc1.totalPaid).toLocaleString('es-CO'),
        numero_recibo_aportes: ssCalc1.planillaNumber,
        periodo_cotizado_inicio: ssCalc1.periodCotizadoInicio,
        periodo_cotizado_fin: ssCalc1.periodCotizadoFin,
        chk_recibo_pago_ss: '[ X ]',
        chk_copias_planillas: '[ X ]',
        chk_anexos_otros: '[   ]',
        observaciones: '(Este espacio es para que el Supervisor (a) realice las anotaciones del caso, respecto del avance de ejecución del contrato, y en general, todas aquellas que pretenda hacer valer respecto del cumplimiento de las obligaciones pactadas con el contratista).',
        firma_supervisor: contract.supervisorName,

        ciudad_fecha_estampillas: 'Armenia Quindío, septiembre de 2026',
        cedula_expedicion_larga: `${contract.idNumber} de ${contract.idCity}- Quindío`,
        direccion_telefono_contratista: `${contract.contractorAddress} ${contract.idCity} -Quindío Teléfono: ${contract.contractorPhone}`,
        especificar_contrato_estampillas: `${contract.contractType}   ${contract.contractNumber}`,
        firma_contratista: contract.contractorName,
        lugar_expedicion_cc: `${contract.idCity}-Quindío`,

        mes_documento: 'septiembre',
        anio_documento: '2026',
        valor_a_pagar_acta_actual: '3.000.000',
        chk_costos_deducciones_no: '[ X ]',
        chk_costos_deducciones_si: '[   ]',
        chk_renta_exenta_si: '[   ]',
        chk_renta_exenta_no: '[ X ]',
        anio_vigencia_anterior: '2025',
        chk_declarante_renta_si: '[   ]',
        chk_declarante_renta_no: '[ X ]',
        correo_contratista: contract.contractorEmail
    };

    const doc1 = await generateDocument('FORMATO CERTIFICADO DEL SUPERVISOR.docx', commonData1);
    const doc2 = await generateDocument('FORMATO INFORME DE ACTIVIDADES.docx', commonData1);
    const doc3 = await generateDocument('FORMATO DESCUENTO DE ESTAMPILLAS.docx', commonData1);
    const doc4 = await generateDocument('FORMATO RETENCION EN LA FUENTE.docx', commonData1);

    period1.certificadoPath = doc1.outputPath;
    period1.informePath = doc2.outputPath;
    period1.estampillasPath = doc3.outputPath;
    period1.retencionPath = doc4.outputPath;

    console.log('✅ Generated Cuenta 1 docx files:');
    console.log('   - 1-CERTIFICADO:', doc1.fileName);
    console.log('   - 2-INFORME:', doc2.fileName);
    console.log('   - 3-ESTAMPILLAS:', doc3.fileName);
    console.log('   - 4-RETENCION:', doc4.fileName);

    const zip1Path = await createBillingZip(period1, contract, user);
    console.log('✅ Generated Cuenta 1 ZIP:', zip1Path);


    // ─────────────────────────────────────────────────────────────
    // TEST 2: CUENTA 2 (Acta 2 - Mes Completo 30 días, Sept 27 - Oct 26)
    // ─────────────────────────────────────────────────────────────
    console.log('\n====================================================');
    console.log('📄 TESTING CUENTA 2 (Acta 2 - 30 Días Ordinarios)');
    console.log('====================================================');

    const period2 = {
        _id: new mongoose.Types.ObjectId(),
        actNumber: 2,
        periodFrom: '2026-09-27',
        periodTo: '2026-10-26',
        securitySocial: {}, // Theoretical automatic liquidation
        activities: [
            {
                obligationCode: '2.2.1',
                obligationText: 'Apoyar el mantenimiento preventivo y correctivo de la infraestructura tecnológica.',
                comment: 'Mantenimiento preventivo a 25 equipos de computo en secretaría.',
                evidences: []
            },
            {
                obligationCode: '2.2.2',
                obligationText: 'Brindar asistencia técnica a las diferentes dependencias de la entidad.',
                comment: 'Soporte a usuarios y configuración de impresoras de red.',
                evidences: []
            }
        ]
    };

    // Calculate theoretical 30-day social security for Cuenta 2
    const ssCalc2 = calculateSocialSecurity(contract, period2, {});
    console.log('✅ SS Calc 2 (automatic 30 days):', {
        ibc: ssCalc2.ibc,
        pension: ssCalc2.pensionPaid,
        salud: ssCalc2.saludPaid,
        arl: ssCalc2.arlPaid,
        total: ssCalc2.totalPaid,
        period: ssCalc2.period,
        periodCotizadoInicio: ssCalc2.periodCotizadoInicio,
        periodCotizadoFin: ssCalc2.periodCotizadoFin
    });

    const commonData2 = {
        fecha_certificado: '31 - 10 - 2026',
        nombre_supervisor: contract.supervisorName,
        dependencia: getFormatNameForDependency(contract.supervisorDependency),
        nombre_contratista: contract.contractorName,
        identificacion_contratista: contract.idNumber,
        tipo_contrato: contract.contractType,
        numero_contrato: contract.contractNumber,
        fecha_acta_inicio: '28 de Agosto de 2026',
        fecha_terminacion: '20 de Diciembre de 2026',
        cdp: contract.cdp,
        rp: contract.rp,
        rubro_presupuestal: contract.rubro,
        valor_total: '11.500.000',
        entidad_bancaria: contract.bankName,
        valor_autorizado_pago: '3.000.000',
        numero_cuenta: contract.accountNumber,
        saldo_restante: '5.500.000', // 11.500.000 - (2 * 3.000.000)
        forma_pago: `${contract.paymentMethod} No. ${contract.accountNumber}`,
        periodo_pagar_inicio: '27 - 09 - 2026',
        periodo_pagar_fin: '26 - 10 - 2026',
        mes_planilla: ssCalc2.period,
        numero_planilla: ssCalc2.planillaNumber || 'POR ASIGNAR',
        valor_pension: Number(ssCalc2.pensionPaid).toLocaleString('es-CO'),
        valor_salud: Number(ssCalc2.saludPaid).toLocaleString('es-CO'),
        valor_arl: Number(ssCalc2.arlPaid).toLocaleString('es-CO'),
        valor_pago_certificado: '3.000.000',
        soporte_acta_inicio_folios: "0", // 0 folios for Acta 2!
        soporte_informe_contratista_folios: "2",
        soporte_informe_supervisor_folios: "1",
        soporte_planilla_folios: "1",
        soporte_recibo_folios: "1",
        chk_anticipo: "___",
        chk_primero: "___",
        chk_segundo: "_ X _", // Checked for Acta 2!
        chk_tercero: "___",
        chk_cuarto: "___",
        chk_quinto: "___",
        chk_sexto: "___",
        chk_septimo: "___",
        chk_octavo: "___",
        chk_noveno: "___",
        chk_otros: "___",
        otros_cual: "",

        objeto_contrato: contract.contractObject,
        plazo_ejecucion: contract.executionTerm,
        acta_parcial_anio: '2026',
        acta_parcial_mes: '10',
        acta_parcial_dia: '31',
        numero_acta_parcial: '2',
        periodo_informado_inicio: '27 - 09 - 2026',
        periodo_informado_fin: '26 - 10 - 2026',
        actividades_desarrolladas: '2.2.1 Apoyar el mantenimiento preventivo y correctivo.\n1 Mantenimiento preventivo a 25 equipos. carpeta2.2.1 Anexo 1.1.\n\n2.2.2 Brindar asistencia técnica.\n2 Soporte a usuarios y configuración. carpeta2.2.2 Anexo 2.1.',
        evidencias_ejecucion: 'Documentos oficiales y soportes anexos en carpetas estructuradas.',
        anticipo: '0',
        valor_acta_1: '3.000.000',
        valor_acta_2: '3.000.000',
        valor_acta_3: '0',
        valor_acta_n: '0',
        saldo_pendiente: '5.500.000',
        otros_contratos_si: '[   ]',
        otros_contratos_no: '[ X ]',
        valor_ingresos_mensualizados: '3.000.000',
        valor_ibc: Number(ssCalc2.ibc).toLocaleString('es-CO'),
        entidad_pago_aportes: ssCalc2.operator,
        valor_total_aporte: Number(ssCalc2.totalPaid).toLocaleString('es-CO'),
        numero_recibo_aportes: ssCalc2.planillaNumber || 'POR ASIGNAR',
        periodo_cotizado_inicio: ssCalc2.periodCotizadoInicio,
        periodo_cotizado_fin: ssCalc2.periodCotizadoFin,
        chk_recibo_pago_ss: '[ X ]',
        chk_copias_planillas: '[ X ]',
        chk_anexos_otros: '[   ]',
        observaciones: '(Este espacio es para que el Supervisor (a) realice las anotaciones del caso, respecto del avance de ejecución del contrato, y en general, todas aquellas que pretenda hacer valer respecto del cumplimiento de las obligaciones pactadas con el contratista).',
        firma_supervisor: contract.supervisorName,

        ciudad_fecha_estampillas: 'Armenia Quindío, octubre de 2026',
        cedula_expedicion_larga: `${contract.idNumber} de ${contract.idCity}- Quindío`,
        direccion_telefono_contratista: `${contract.contractorAddress} ${contract.idCity} -Quindío Teléfono: ${contract.contractorPhone}`,
        especificar_contrato_estampillas: `${contract.contractType}   ${contract.contractNumber}`,
        firma_contratista: contract.contractorName,
        lugar_expedicion_cc: `${contract.idCity}-Quindío`,

        mes_documento: 'octubre',
        anio_documento: '2026',
        valor_a_pagar_acta_actual: '3.000.000',
        chk_costos_deducciones_no: '[ X ]',
        chk_costos_deducciones_si: '[   ]',
        chk_renta_exenta_si: '[   ]',
        chk_renta_exenta_no: '[ X ]',
        anio_vigencia_anterior: '2025',
        chk_declarante_renta_si: '[   ]',
        chk_declarante_renta_no: '[ X ]',
        correo_contratista: contract.contractorEmail
    };

    const doc2_1 = await generateDocument('FORMATO CERTIFICADO DEL SUPERVISOR.docx', commonData2);
    const doc2_2 = await generateDocument('FORMATO INFORME DE ACTIVIDADES.docx', commonData2);
    const doc2_3 = await generateDocument('FORMATO DESCUENTO DE ESTAMPILLAS.docx', commonData2);
    const doc2_4 = await generateDocument('FORMATO RETENCION EN LA FUENTE.docx', commonData2);

    period2.certificadoPath = doc2_1.outputPath;
    period2.informePath = doc2_2.outputPath;
    period2.estampillasPath = doc2_3.outputPath;
    period2.retencionPath = doc2_4.outputPath;

    console.log('✅ Generated Cuenta 2 docx files:');
    console.log('   - 1-CERTIFICADO:', doc2_1.fileName);
    console.log('   - 2-INFORME:', doc2_2.fileName);
    console.log('   - 3-ESTAMPILLAS:', doc2_3.fileName);
    console.log('   - 4-RETENCION:', doc2_4.fileName);

    const zip2Path = await createBillingZip(period2, contract, user);
    console.log('✅ Generated Cuenta 2 ZIP:', zip2Path);

    console.log('\n====================================================');
    console.log('🎯 AUDIT COMPLETED SUCCESSFULLY FOR BOTH ACTAS!');
    console.log('====================================================');
}

testCompleteGeneration().catch(console.error);

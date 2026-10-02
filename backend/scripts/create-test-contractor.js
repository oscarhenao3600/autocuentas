require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Contract = require('../models/Contract');
const TelegramPrivilege = require('../models/TelegramPrivilege');
const BillingPeriod = require('../models/BillingPeriod');

async function createTestContractor() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27019/formatos_cuentas';
    console.log('🔌 Conectando a MongoDB en:', mongoUri);
    await mongoose.connect(mongoUri);

    const CEDULA = '1234567890';
    const TELEGRAM_CHAT_ID = '814479301';
    const EMAIL = 'pruebas1234567890@autocuentas.com';
    const RAW_PASSWORD = 'Password123*';
    const FULL_NAME = 'Contratista de Pruebas QA';

    console.log(`\n🛠️  Creando/Actualizando Contratista de Pruebas...`);
    console.log(`   Cédula: ${CEDULA}`);
    console.log(`   Telegram Chat ID: ${TELEGRAM_CHAT_ID}`);
    console.log(`   Correo: ${EMAIL}`);

    // 1. Crear o actualizar Usuario
    let user = await User.findOne({
        $or: [
            { email: EMAIL },
            { telegramChatId: TELEGRAM_CHAT_ID }
        ]
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(RAW_PASSWORD, salt);

    if (user) {
        console.log(`ℹ️  Usuario existente encontrado (${user._id}). Actualizando datos y privilegios...`);
        user.fullName = FULL_NAME;
        user.email = EMAIL;
        user.password = hashedPassword;
        user.role = 'client';
        user.telegramChatId = TELEGRAM_CHAT_ID;
        user.isPaymentExempt = true;
        user.exemptReason = 'Contratista de Pruebas QA - Cuentas y ZIPs ilimitados';
        user.pricingPlan = 'package';
        user.packageQuota = 99999;
        user.packageAccountsUsed = 0;
        await user.save();
    } else {
        console.log(`✨ Creando nuevo usuario...`);
        user = await User.create({
            fullName: FULL_NAME,
            email: EMAIL,
            password: hashedPassword,
            role: 'client',
            telegramChatId: TELEGRAM_CHAT_ID,
            isPaymentExempt: true,
            exemptReason: 'Contratista de Pruebas QA - Cuentas y ZIPs ilimitados',
            pricingPlan: 'package',
            packageQuota: 99999,
            packageAccountsUsed: 0
        });
    }
    console.log(`✅ Usuario configurado con ID: ${user._id}`);

    // 2. Crear o actualizar TelegramPrivilege para operador sin restricciones
    let privilege = await TelegramPrivilege.findOne({ telegramChatId: TELEGRAM_CHAT_ID });
    if (privilege) {
        privilege.label = 'Operador de Pruebas QA';
        privilege.description = `Acceso ilimitado para pruebas integrales de contratista ${CEDULA}`;
        privilege.scope = 'all';
        privilege.operatorType = 'exempt';
        privilege.monthlyAccountsLimit = 99999;
        privilege.packageQuota = 99999;
        privilege.canRegisterFuncionarios = true;
        privilege.isActive = true;
        await privilege.save();
    } else {
        privilege = await TelegramPrivilege.create({
            telegramChatId: TELEGRAM_CHAT_ID,
            label: 'Operador de Pruebas QA',
            description: `Acceso ilimitado para pruebas integrales de contratista ${CEDULA}`,
            scope: 'all',
            operatorType: 'exempt',
            monthlyAccountsLimit: 99999,
            packageQuota: 99999,
            canRegisterFuncionarios: true,
            isActive: true,
            createdBy: user._id
        });
    }
    console.log(`✅ Privilegios de Telegram configurados (Exento / Ilimitado) para Chat ID: ${TELEGRAM_CHAT_ID}`);

    // 3. Crear o actualizar Contrato con soporte para Cuenta 1, Cuenta 2 y Adiciones
    let contract = await Contract.findOne({ idNumber: CEDULA });
    const contractData = {
        user: user._id,
        entityName: 'Alcaldía de Armenia',
        contractAlias: 'Contrato de Pruebas y Validación',
        status: 'active',
        contractorName: FULL_NAME,
        idNumber: CEDULA,
        contractNumber: 'CO1.PCCNTR.TEST.1234567890',
        contractType: 'PRESTACIÓN DE SERVICIOS PROFESIONALES Y DE APOYO A LA GESTIÓN',
        contractObject: 'Prestar servicios profesionales para el desarrollo, pruebas integrales, validación de etapas contractuales y generación de formatos y soportes en la plataforma AutoCuentas.',
        startDate: '2026-01-15',
        endDate: '2026-05-14',
        initialDurationMonths: 4,
        periodType: 'mes_cumplido',
        cutoffDay: 25,
        totalValue: '16000000',
        monthlyValue: '4000000',
        totalValueWord: 'DIECISÉIS MILLONES DE PESOS M/CTE',
        monthlyValueWord: 'CUATRO MILLONES DE PESOS M/CTE',
        bankName: 'BANCOLOMBIA',
        accountNumber: '123-456789-01',
        paymentMethod: 'Ahorros',
        supervisorName: 'Ing. Supervisor de Pruebas',
        supervisorDependency: 'Secretaría de las Tecnologías de la Información y las Comunicaciones',
        unidadEjecutora: 'Secretaría TIC',
        unidadEjecutoraCodigo: 'TIC-01',
        unidadContratacion: 'Dirección de Contratación',
        fuenteFinanciacion: 'Recursos Propios',
        fuenteCodigo: 'RP-01',
        cdp: '100201',
        rp: '200301',
        rubro: '2.1.2.02.02.008',
        contractorAddress: 'Calle 10 # 15-20',
        contractorPhone: '3001234567',
        contractorEmail: EMAIL,
        idCity: 'Armenia',
        takesCosts: false,
        takesExemptRent: true,
        isTaxFiler: false,
        activities: [
            '2.2.1. Realizar pruebas exhaustivas de generación de documentos y actas parciales del sistema.',
            '2.2.2. Ejecutar validación de carga de evidencias, fotografías y archivos de soporte mediante Telegram.',
            '2.2.3. Verificar la consistencia de cálculos de seguridad social, IBC, estampillas y retención en la fuente.',
            '2.2.4. Probar la etapa de adiciones contractuales, prórrogas y generación de paquetes ZIP completos.'
        ],
        // ── Datos de Adición Contractual para pruebas ──
        hasAddition: true,
        additionDurationMonths: 2,
        additionDuration: 'DOS (02) MESES',
        additionValue: '8000000',
        additionValueWord: 'OCHO MILLONES DE PESOS M/CTE',
        additionStartDate: '2026-05-15',
        additionEndDate: '2026-07-14',
        additionCdp: '100202',
        additionRp: '200302',
        additionRubro: '2.1.2.02.02.008'
    };

    if (contract) {
        console.log(`ℹ️  Contrato existente encontrado (${contract._id}). Actualizando...`);
        Object.assign(contract, contractData);
        await contract.save();
    } else {
        console.log(`✨ Creando contrato con soporte de Cuenta 1, 2 y Adiciones...`);
        contract = await Contract.create(contractData);
    }
    console.log(`✅ Contrato configurado con ID: ${contract._id}`);

    // 4. Crear Periodos de Cobro iniciales listos para probar (Acta 1, Acta 2 y Acta 5 de Adición)
    const actsToPrepare = [
        {
            actNumber: 1,
            periodFrom: new Date('2026-01-15T00:00:00.000Z'),
            periodTo: new Date('2026-02-14T23:59:59.000Z'),
            stage: 'Cuenta 1 (Primer Pago Inicial)'
        },
        {
            actNumber: 2,
            periodFrom: new Date('2026-02-15T00:00:00.000Z'),
            periodTo: new Date('2026-03-14T23:59:59.000Z'),
            stage: 'Cuenta 2 (Segundo Pago Inicial)'
        },
        {
            actNumber: 5,
            periodFrom: new Date('2026-05-15T00:00:00.000Z'),
            periodTo: new Date('2026-06-14T23:59:59.000Z'),
            stage: 'Cuenta 5 (Primer Pago de la Adición)'
        }
    ];

    for (const act of actsToPrepare) {
        let period = await BillingPeriod.findOne({ user: user._id, actNumber: act.actNumber });
        const activitiesData = contract.activities.map((actText, idx) => ({
            obligationCode: `2.2.${idx + 1}`,
            obligationText: actText,
            comment: `Actividades ejecutadas a total satisfacción para el acta ${act.actNumber}.`,
            evidences: []
        }));

        if (!period) {
            period = await BillingPeriod.create({
                user: user._id,
                contract: contract._id,
                actNumber: act.actNumber,
                periodFrom: act.periodFrom,
                periodTo: act.periodTo,
                activities: activitiesData,
                status: 'pending',
                isPaid: true,
                paymentStatus: 'exempt',
                securitySocial: {
                    operator: 'ARUS',
                    planillaNumber: `948572${act.actNumber}`,
                    saludPaid: 640000,
                    pensionPaid: 256000,
                    arlPaid: 21100,
                    totalPaid: 917100,
                    period: 'FEBRERO',
                    ibc: 1600000,
                    days: 30
                }
            });
            console.log(`✨ Periodo Acta #${act.actNumber} (${act.stage}) creado con éxito.`);
        } else {
            period.contract = contract._id;
            period.isPaid = true;
            period.paymentStatus = 'exempt';
            await period.save();
            console.log(`ℹ️  Periodo Acta #${act.actNumber} (${act.stage}) verificado como exento.`);
        }
    }

    console.log(`\n🎉 ¡CONTRATISTA DE PRUEBAS CONFIGURADO EXITOSAMENTE!`);
    console.log(`══════════════════════════════════════════════════════`);
    console.log(`👤 Nombre:          ${FULL_NAME}`);
    console.log(`🆔 Cédula:          ${CEDULA}`);
    console.log(`📱 Telegram ChatId: ${TELEGRAM_CHAT_ID}`);
    console.log(`📧 Correo Login:    ${EMAIL}`);
    console.log(`🔑 Contraseña:      ${RAW_PASSWORD}`);
    console.log(`📑 Contrato:        CO1.PCCNTR.TEST.1234567890`);
    console.log(`💎 Estado Pagos:    EXENTO ILIMITADO (Genera cualquier cantidad de ZIPs)`);
    console.log(`🔄 Etapas listas:   Acta 1 (Primer pago), Acta 2 (Segundo pago), Acta 5 (Adición)`);
    console.log(`══════════════════════════════════════════════════════\n`);

    await mongoose.disconnect();
}

createTestContractor().catch(err => {
    console.error('❌ Error configurando contratista de pruebas:', err);
    process.exit(1);
});

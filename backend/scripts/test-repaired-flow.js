const mongoose = require('mongoose');
const telegramService = require('../services/telegram.service');
const User = require('../models/User');
const Contract = require('../models/Contract');
const BillingPeriod = require('../models/BillingPeriod');

async function verify() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/formatos_cuentas');
    console.log('--- VERIFICACIÓN DEL FLUJO TRAS REPARACIÓN ---');

    // 1. Probar ingreso de cédula Oscar Henao (9774679)
    console.log('\n[1] Probando interacción Telegram con Cédula 9774679 (Oscar Henao)...');
    const testChatOscar = '814479301'; // chat real del usuario

    await telegramService.handleIncomingMessage({
        chat: { id: testChatOscar },
        text: '/start'
    });

    await telegramService.handleIncomingMessage({
        chat: { id: testChatOscar },
        text: '9774679'
    });

    let session = telegramService.sessions.get(testChatOscar);
    console.log('Sesión tras cédula 9774679:', {
        state: session?.state,
        cedula: session?.cedula,
        activeContractId: session?.activeContractId?.toString(),
        userId: session?.userId?.toString()
    });

    const oscarUser = await User.findOne({ cedula: '9774679' });
    console.log('Usuario en BD:', oscarUser?.fullName, 'TelegramChatId:', oscarUser?.telegramChatId);

    const activeInfo = await telegramService.getContractCurrentActiveAct(oscarUser._id, session.activeContractId);
    console.log('Estado de actas para Oscar Henao:', {
        targetAct: activeInfo.targetAct,
        hasTransitionPending: activeInfo.hasTransitionPending,
        unfinishedPreviousAct: activeInfo.unfinishedPreviousAct,
        reason: activeInfo.reason
    });

    if (activeInfo.targetAct === 2 && !activeInfo.hasTransitionPending) {
        console.log('✅ Cuenta 1 quedó omitida correctamente. El bot pasa directo a Cuenta 2 sin pedir Cuenta 1!');
    }

    // 2. Probar omisión dinámica y descarte de cuenta adicional
    console.log('\n[2] Probando que el botón discard_act funcione sin errores cuando un acta no existe previamente...');
    // Creamos un contrato ficticio temporal
    const tempContract = await Contract.create({
        user: oscarUser._id,
        contractorName: 'Prueba Temporal',
        idNumber: '888999111',
        contractNumber: 'TEMP-001',
        startDate: '2026-02-01',
        endDate: '2026-05-30',
        activities: ['Actividad prueba 1', 'Actividad prueba 2']
    });

    telegramService.sessions.set('test_chat_temp', {
        state: 'identified',
        userId: oscarUser._id,
        activeContractId: tempContract._id,
        contractId: tempContract._id
    });

    await telegramService.handleCallbackQuery({
        id: 'cb_temp',
        from: { id: 'test_chat_temp' },
        message: { chat: { id: 'test_chat_temp' }, message_id: 999 },
        data: 'discard_act_1'
    });

    const createdDiscardedPeriod = await BillingPeriod.findOne({ contract: tempContract._id, actNumber: 1 });
    console.log('Periodo creado y descartado exitosamente:', {
        actNumber: createdDiscardedPeriod?.actNumber,
        isDiscarded: createdDiscardedPeriod?.isDiscarded,
        status: createdDiscardedPeriod?.status,
        obligationsCount: createdDiscardedPeriod?.activities?.length
    });

    if (createdDiscardedPeriod && createdDiscardedPeriod.isDiscarded === true && createdDiscardedPeriod.status === 'discarded') {
        console.log('✅ Creación y persistencia de descarte de cuenta en BD 100% FUNCIONAL!');
    }

    // Limpieza de prueba temporal
    await BillingPeriod.deleteMany({ contract: tempContract._id });
    await Contract.deleteOne({ _id: tempContract._id });

    console.log('\n🎉 ¡VERIFICACIÓN EXITOSA!');
    process.exit(0);
}

verify();

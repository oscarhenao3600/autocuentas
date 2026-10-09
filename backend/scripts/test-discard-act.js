const mongoose = require('mongoose');
const telegramService = require('../services/telegram.service');
const User = require('../models/User');
const Contract = require('../models/Contract');
const BillingPeriod = require('../models/BillingPeriod');

async function testDiscardAct() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/formatos_cuentas');
    console.log('--- TEST discard_act_1 ---');

    const chatId = '814479301';
    const user = await User.findOne({ telegramChatId: chatId });
    console.log('Usuario encontrado:', user?.fullName, user?._id);

    const contract = await Contract.findOne({ user: user._id, idNumber: '9774679' });
    console.log('Contrato 9774679:', contract?._id, contract?.contractNumber);

    telegramService.sessions.set(chatId, {
        state: 'identified',
        userId: user._id,
        activeContractId: contract._id,
        contractId: contract._id
    });

    try {
        console.log('Ejecutando handleCallbackQuery discard_act_1...');
        await telegramService.handleCallbackQuery({
            id: 'cb_test_discard',
            from: { id: chatId },
            message: { chat: { id: chatId }, message_id: 201 },
            data: 'discard_act_1'
        });
        console.log('Callback ejecutado sin error aparente.');

        const bp = await BillingPeriod.findOne({ user: user._id, contract: contract._id, actNumber: 1 });
        console.log('Estado de BillingPeriod tras descarte:', {
            _id: bp?._id,
            actNumber: bp?.actNumber,
            isDiscarded: bp?.isDiscarded,
            status: bp?.status,
            discardedAt: bp?.discardedAt
        });
    } catch (err) {
        console.error('ERROR al descartar acta:', err);
    }

    process.exit(0);
}

testDiscardAct();

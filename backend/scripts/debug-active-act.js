const mongoose = require('mongoose');
const telegramService = require('../services/telegram.service');
const Contract = require('../models/Contract');
const User = require('../models/User');
const BillingPeriod = require('../models/BillingPeriod');

async function testActiveActs() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/formatos_cuentas');
    console.log('--- TEST getContractCurrentActiveAct ---');

    const contracts = await Contract.find({}).populate('user');
    for (const c of contracts) {
        console.log(`\nContrato: ${c.contractNumber} (${c.contractorName}, Cédula: ${c.idNumber})`);
        console.log(`Fechas: ${c.startDate} a ${c.endDate}`);
        try {
            const result = await telegramService.getContractCurrentActiveAct(c.user?._id, c._id, c);
            console.log('Resultado getContractCurrentActiveAct:', {
                targetAct: result.targetAct,
                hasTransitionPending: result.hasTransitionPending,
                hasUnfinishedPreviousAct: result.hasUnfinishedPreviousAct,
                unfinishedPreviousAct: result.unfinishedPreviousAct,
                inGracePeriod: result.inGracePeriod,
                graceDaysRemaining: result.graceDaysRemaining,
                canStartNextAct: result.canStartNextAct,
                reason: result.reason
            });
        } catch (err) {
            console.error('Error calculando active act:', err);
        }
    }

    process.exit(0);
}

testActiveActs();

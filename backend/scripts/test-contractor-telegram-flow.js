require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Contract = require('../models/Contract');
const BillingPeriod = require('../models/BillingPeriod');
const { getContractCurrentActiveAct } = require('../services/telegram.service');
const { generateBillingPackage } = require('../controllers/billing.controller');

async function testContractorFlow() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27019/formatos_cuentas');
        console.log('Connected to MongoDB.');

        const user = await User.findOne({ email: 'pruebas1234567890@autocuentas.com' });
        if (!user) {
            console.error('Test user not found!');
            process.exit(1);
        }
        console.log(`Found test user: ${user.fullName} (${user.email}), ChatId: ${user.telegramChatId}`);

        const allContracts = await Contract.find({ user: user._id });
        console.log(`User has ${allContracts.length} contract(s):`, allContracts.map(c => ({ id: c._id, num: c.contractNumber, start: c.startDate })));
        
        let contract = allContracts.find(c => c.contractNumber === 'CO1.PCCNTR.TEST.1234567890') || allContracts[0];
        console.log(`Selected contract: ${contract.contractNumber}, startDate: ${contract.startDate}`);

        // Set period 1 as pending and not downloaded to test the transition
        let period1 = await BillingPeriod.findOne({ user: user._id, contract: contract._id, actNumber: 1 });
        if (period1) {
            period1.zipDownloaded = false;
            period1.status = 'pending';
            await period1.save();
        }

        const activeInfo = await getContractCurrentActiveAct(user._id, contract._id, contract);
        console.log('\n--- Active Info for Test Contractor: ---');
        console.log('targetAct:', activeInfo.targetAct);
        console.log('hasTransitionPending:', activeInfo.hasTransitionPending);
        console.log('unfinishedPreviousAct:', activeInfo.unfinishedPreviousAct);
        console.log('inGracePeriod:', activeInfo.inGracePeriod);
        console.log('graceDaysRemaining:', activeInfo.graceDaysRemaining);
        console.log('reason:', activeInfo.reason);

        if (!activeInfo.hasTransitionPending) {
            console.error('Expected hasTransitionPending to be true!');
            process.exit(1);
        }

        console.log('\n--- Testing ZIP generation for Cuenta 1 in transition: ---');
        const genResult = await generateBillingPackage(period1._id, user._id);
        console.log(`ZIP generated successfully: ${genResult.zipPath}`);

        // Check that period 1 is marked as downloaded
        period1 = await BillingPeriod.findById(period1._id);
        console.log(`Period 1 zipDownloaded: ${period1.zipDownloaded}`);

        console.log('\n✅ Contractor transition & generation verified successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Test failed with error:', err);
        process.exit(1);
    }
}

testContractorFlow();

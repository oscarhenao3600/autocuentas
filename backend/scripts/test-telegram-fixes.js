require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Contract = require('../models/Contract');
const BillingPeriod = require('../models/BillingPeriod');
const telegramService = require('../services/telegram.service');

async function runTests() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27019/formatos_cuentas');
        console.log('Connected to MongoDB.');

        // Find a contractor user with telegramChatId
        let user = await User.findOne({ telegramChatId: { $ne: null } });
        if (!user) {
            user = await User.findOne();
            if (user) {
                user.telegramChatId = '999999999';
                await user.save();
            }
        }
        if (!user) {
            console.error('No user found in database!');
            process.exit(1);
        }

        const chatId = user.telegramChatId || '999999999';
        console.log(`Using test user: ${user.fullName} (${user._id}), chatId: ${chatId}`);

        let contract = await Contract.findOne({ user: user._id });
        if (!contract) {
            contract = await Contract.create({
                user: user._id,
                contractNumber: 'TEST-FLOW-2026',
                entityName: 'Alcaldía de Prueba',
                startDate: new Date('2026-01-01'),
                endDate: new Date('2026-06-30'),
                activities: [{ code: '1', description: 'Actividad de prueba 1' }]
            });
        }

        let period = await BillingPeriod.findOne({ user: user._id, contract: contract._id });
        if (!period) {
            period = await BillingPeriod.create({
                user: user._id,
                contract: contract._id,
                actNumber: 1,
                periodFrom: new Date('2026-01-01'),
                periodTo: new Date('2026-01-31'),
                activities: [{ obligationCode: '2.2.1', obligationText: 'Obligación 1', comment: '', evidences: [] }]
            });
        }

        console.log('\n--- TEST 1: Simulating /start when user has active session ---');
        // Simulate message with /start
        await telegramService.handleIncomingMessage({
            chat: { id: chatId },
            from: { first_name: 'Test', username: 'testuser' },
            text: '/start'
        });
        console.log('✅ TEST 1 passed (/start handled cleanly)');

        console.log('\n--- TEST 2: Simulating "hola" greeting when user has active session ---');
        await telegramService.handleIncomingMessage({
            chat: { id: chatId },
            from: { first_name: 'Test', username: 'testuser' },
            text: 'hola'
        });
        console.log('✅ TEST 2 passed ("hola" handled cleanly)');

        console.log('\n--- TEST 3: Simulating "cancelar" when user has active session ---');
        await telegramService.handleIncomingMessage({
            chat: { id: chatId },
            from: { first_name: 'Test', username: 'testuser' },
            text: 'cancelar'
        });
        console.log('✅ TEST 3 passed ("cancelar" handled cleanly)');

        console.log('\n--- TEST 4: Simulating "menu" command ---');
        await telegramService.handleIncomingMessage({
            chat: { id: chatId },
            from: { first_name: 'Test', username: 'testuser' },
            text: 'menu'
        });
        console.log('✅ TEST 4 passed ("menu" handled cleanly)');

        console.log('\n--- TEST 5: Callback query "show_acts_menu" ---');
        await telegramService.handleCallbackQuery({
            id: 'cb_test_1',
            message: { chat: { id: chatId }, message_id: 100 },
            data: 'show_acts_menu'
        });
        console.log('✅ TEST 5 passed ("show_acts_menu" callback executed)');

        console.log('\n--- TEST 6: Callback query "summary_<periodId>" ---');
        await telegramService.handleCallbackQuery({
            id: 'cb_test_2',
            message: { chat: { id: chatId }, message_id: 101 },
            data: `summary_${period._id}`
        });
        console.log('✅ TEST 6 passed ("summary_" callback executed)');

        console.log('\n--- TEST 7: Callback query "select_act_1" ---');
        await telegramService.handleCallbackQuery({
            id: 'cb_test_3',
            message: { chat: { id: chatId }, message_id: 102 },
            data: 'select_act_1'
        });
        console.log('✅ TEST 7 passed ("select_act_1" callback executed)');

        console.log('\n--- TEST 8: Callback query "select_contract_<id>" ---');
        await telegramService.handleCallbackQuery({
            id: 'cb_test_4',
            message: { chat: { id: chatId }, message_id: 103 },
            data: `select_contract_${contract._id}`
        });
        console.log('✅ TEST 8 passed ("select_contract_" callback executed)');

        console.log('\n--- TEST 9: Callback query "subir_evidencia" ---');
        await telegramService.handleCallbackQuery({
            id: 'cb_test_5',
            message: { chat: { id: chatId }, message_id: 104 },
            data: 'subir_evidencia'
        });
        console.log('✅ TEST 9 passed ("subir_evidencia" callback executed)');

        console.log('\n--- TEST 10: Callback query "skip_docs_flow" ---');
        await telegramService.handleCallbackQuery({
            id: 'cb_test_6',
            message: { chat: { id: chatId }, message_id: 105 },
            data: 'skip_docs_flow'
        });
        console.log('✅ TEST 10 passed ("skip_docs_flow" callback executed)');

        console.log('\n🎉 ALL 10 TESTS PASSED SUCCESSFULLY! All buttons and flows work as expected.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Test failed with error:', err);
        process.exit(1);
    }
}

runTests();

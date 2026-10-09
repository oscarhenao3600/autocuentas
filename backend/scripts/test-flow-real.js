const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const telegramService = require('../services/telegram.service');

async function testFullUserFlow() {
    await mongoose.connect(process.env.MONGODB_URI);
    const chatId = 814479301;
    const testCedula = '7776665544';

    console.log('[1] Enviando /start...');
    await telegramService.handleIncomingMessage({
        chat: { id: chatId },
        from: { id: chatId, first_name: 'Oscar' },
        text: '/start'
    });

    console.log('[2] Enviando cédula no registrada...');
    await telegramService.handleIncomingMessage({
        chat: { id: chatId },
        from: { id: chatId, first_name: 'Oscar' },
        text: testCedula
    });

    console.log('[3] Pulsando "start_registration"...');
    await telegramService.handleCallbackQuery({
        id: 'cb_test_user',
        from: { id: chatId },
        message: { chat: { id: chatId }, message_id: 9999 },
        data: 'start_registration'
    });

    console.log('[4] Fin de simulación.');
    process.exit(0);
}

testFullUserFlow().catch(console.error);

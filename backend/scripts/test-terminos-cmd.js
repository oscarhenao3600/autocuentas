const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const telegramService = require('../services/telegram.service');

async function testTerminosCommand() {
    await mongoose.connect(process.env.MONGODB_URI);
    const chatId = 814479301;
    console.log('Probando comando /terminos para chatId:', chatId);
    await telegramService.handleIncomingMessage({
        chat: { id: chatId },
        text: '/terminos'
    });
    console.log('Comando /terminos ejecutado.');
    process.exit(0);
}

testTerminosCommand().catch(console.error);

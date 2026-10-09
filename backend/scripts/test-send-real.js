const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sendTelegramDocument, showTermsAndConditionsPrompt } = require('../services/telegram.service');
const { getTermsPdfBuffer } = require('../utils/terms_pdf');

async function testSend() {
    const chatId = '814479301';
    console.log('Probando getTermsPdfBuffer...');
    const termsRes = await getTermsPdfBuffer();
    console.log('termsRes:', {
        hasBuffer: !!termsRes.buffer,
        bufferLength: termsRes.buffer?.length,
        filename: termsRes.filename
    });

    console.log('\nProbando sendTelegramDocument...');
    await sendTelegramDocument(
        chatId,
        termsRes.buffer,
        '📄 Test Documento Oficial: ' + termsRes.filename,
        termsRes.filename
    );
}

testSend().then(() => console.log('Finished')).catch(err => console.error('Error:', err));

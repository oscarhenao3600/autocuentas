const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getTermsPdfBuffer } = require('../utils/terms_pdf');

async function testFormDataSend() {
    const chatId = '814479301';
    const termsRes = await getTermsPdfBuffer();
    const token = process.env.TELEGRAM_BOT_TOKEN;

    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', '📄 Documento Oficial de Términos y Condiciones');
    form.append('document', new Blob([termsRes.buffer]), termsRes.filename);

    console.log('Enviando con FormData nativo...');
    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: form
    });

    const data = await response.json();
    console.log('Resultado Telegram:', data);
    process.exit(0);
}

testFormDataSend().catch(console.error);

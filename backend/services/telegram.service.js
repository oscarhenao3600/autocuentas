const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Contract = require('../models/Contract');
const BillingPeriod = require('../models/BillingPeriod');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let lastUpdateId = 0;
let isPolling = false;

/**
 * Envía un mensaje de texto por Telegram
 * @param {string} chatId - ID del chat del usuario
 * @param {string} text - Contenido del mensaje (soporta HTML)
 */
const sendTelegramMessage = async (chatId, text) => {
    if (!TELEGRAM_TOKEN) return;
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            })
        });
        const data = await response.json();
        if (!data.ok) {
            console.error('⚠️ Error al enviar mensaje Telegram:', data.description);
        }
    } catch (err) {
        console.error('❌ Error en sendTelegramMessage:', err.message);
    }
};

/**
 * Envía un archivo binario por Telegram
 * @param {string} chatId - ID del chat del usuario
 * @param {string} filePath - Ruta absoluta del archivo
 * @param {string} caption - Texto descriptivo adjunto al archivo
 */
const sendTelegramDocument = async (chatId, filePath, caption) => {
    if (!TELEGRAM_TOKEN || !fs.existsSync(filePath)) return;
    try {
        const filename = path.basename(filePath);
        const fileBuffer = fs.readFileSync(filePath);
        
        // Crear un FormData manual en formato Multipart
        const boundary = '----TelegramBotBoundary' + Date.now().toString(16);
        const header = `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${filename}"\r\nContent-Type: application/zip\r\n\r\n`;
        const footer = `\r\n--${boundary}--\r\n`;
        
        // Unificar encabezado, buffer del archivo y pie de página en un solo ArrayBuffer
        const headerBuffer = Buffer.from(header, 'utf-8');
        const footerBuffer = Buffer.from(footer, 'utf-8');
        const multipartBody = Buffer.concat([headerBuffer, fileBuffer, footerBuffer]);

        // Campos adicionales como chatId y caption
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument?chat_id=${chatId}&caption=${encodeURIComponent(caption)}`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: multipartBody
        });
        
        const data = await response.json();
        if (!data.ok) {
            console.error('⚠️ Error al enviar documento Telegram:', data.description);
        } else {
            console.log(`✅ Documento ${filename} enviado por Telegram con éxito.`);
        }
    } catch (err) {
        console.error('❌ Error en sendTelegramDocument:', err.message);
    }
};

/**
 * Procesa un mensaje recibido del usuario en Telegram
 * @param {Object} message - Objeto mensaje de Telegram
 */
const handleIncomingMessage = async (message) => {
    const chatId = message.chat.id.toString();
    const text = (message.text || '').trim();

    if (text.startsWith('/start')) {
        const parts = text.split(' ');
        if (parts.length > 1) {
            const code = parts[1].trim();
            // Buscar usuario con este código de verificación
            const user = await User.findOne({ telegramVerificationCode: code });
            if (user) {
                user.telegramChatId = chatId;
                user.telegramVerificationCode = null; // Consumir el código
                await user.save();

                await sendTelegramMessage(chatId, `🎉 <b>¡Hola ${user.fullName}!</b>\n\nTu cuenta ha sido vinculada con éxito en <b>FormatosCuentas</b>.\n\nDe ahora en adelante, te notificaré por este medio tan pronto como tu cuenta de cobro del mes esté lista para descargar.\n\n💡 Envía <b>/descargar</b> en cualquier momento para obtener tu último paquete de cobro listo.`);
            } else {
                await sendTelegramMessage(chatId, `❌ El código de verificación <b>"${code}"</b> es inválido o ya ha expirado.\n\nPor favor verifica tu código en la sección de Telegram dentro de la aplicación web e inténtalo de nuevo.`);
            }
        } else {
            await sendTelegramMessage(chatId, `👋 <b>¡Bienvenido al Bot de FormatosCuentas!</b>\n\nPara vincular tu cuenta, inicia sesión en la plataforma web y copia tu código de vinculación de 6 dígitos.\n\nLuego envíalo aquí con el formato: <code>/start [codigo]</code>`);
        }
    } else if (text === '/descargar' || text.toLowerCase() === 'descargar' || text.toLowerCase() === 'cuenta') {
        // Buscar el usuario vinculado a este Chat ID
        const user = await User.findOne({ telegramChatId: chatId });
        if (!user) {
            await sendTelegramMessage(chatId, `⚠️ Tu cuenta no está vinculada.\n\nPor favor inicia sesión en la web y envía <code>/start [codigo_de_vinculacion]</code>.`);
            return;
        }

        // Buscar el último periodo de cobro aprobado o en borrador
        const billingPeriod = await BillingPeriod.findOne({ user: user._id })
            .sort({ createdAt: -1 });

        if (!billingPeriod) {
            await sendTelegramMessage(chatId, `📭 Aún no tienes periodos de cuenta registrados en el sistema.`);
            return;
        }

        if (billingPeriod.zipPath && fs.existsSync(billingPeriod.zipPath)) {
            await sendTelegramMessage(chatId, `📦 Generando tu paquete de cobro para el acta número <b>${billingPeriod.actNumber}</b>...`);
            await sendTelegramDocument(chatId, billingPeriod.zipPath, `Paquete de Cobro - Acta ${billingPeriod.actNumber} (Alcaldía de Armenia)`);
        } else {
            await sendTelegramMessage(chatId, `⚠️ Tu cuenta del mes está registrada con estado <b>"${billingPeriod.status === 'pending' ? 'Pendiente' : 'Borrador'}"</b> pero el archivo comprimido aún no está listo.\n\nPor favor espera que el supervisor lo apruebe o solicítalo directamente desde el panel web de la aplicación.`);
        }
    } else {
        await sendTelegramMessage(chatId, `🤖 <b>FormatosCuentas Bot</b>\n\nComandos disponibles:\n• <code>/descargar</code> - Obtiene tu último paquete de cobro unificado en ZIP/RAR.\n\n<i>Si necesitas asistencia técnica, ponte en contacto con el administrador de la plataforma.</i>`);
    }
};

/**
 * Bucle de Long Polling para escuchar mensajes del Bot de Telegram en segundo plano
 */
const startTelegramPolling = async () => {
    if (isPolling) return;
    isPolling = true;

    console.log('🤖 Iniciando servicio de Telegram Bot (Polling)...');

    const poll = async () => {
        if (!TELEGRAM_TOKEN) {
            console.log('⚠️ TELEGRAM_BOT_TOKEN no configurado en .env. Saltando servicio de Telegram.');
            isPolling = false;
            return;
        }

        try {
            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId}&timeout=30`);
            const data = await response.json();

            if (data.ok && data.result.length > 0) {
                for (const update of data.result) {
                    lastUpdateId = update.update_id + 1;
                    if (update.message) {
                        try {
                            await handleIncomingMessage(update.message);
                        } catch (err) {
                            console.error('❌ Error procesando mensaje de Telegram:', err.message);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('⚠️ Error de conexión en Telegram Polling:', err.message);
            // Esperar 10 segundos antes de reintentar ante fallo de red
            await new Promise(resolve => setTimeout(resolve, 10000));
        }

        // Ejecutar siguiente ciclo de polling de inmediato
        if (isPolling) {
            setTimeout(poll, 100);
        }
    };

    poll();
};

module.exports = {
    startTelegramPolling,
    sendTelegramMessage,
    sendTelegramDocument
};

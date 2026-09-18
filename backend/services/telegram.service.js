const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Contract = require('../models/Contract');
const BillingPeriod = require('../models/BillingPeriod');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let lastUpdateId = 0;
let isPolling = false;

// Map to manage user sessions in memory
const sessions = new Map();

/**
 * Calculates start and end dates for a billing period based on contract config
 */
function calculatePeriods(startDateStr, initialMonths = 4, additionMonths = 0, periodType = 'mes_cumplido') {
    if (!startDateStr) return [];
    let periods = [];
    const totalPeriods = Number(initialMonths) + Number(additionMonths || 0);
    let currentStart = new Date(startDateStr + 'T00:00:00');
    
    for (let i = 1; i <= totalPeriods; i++) {
        let currentEnd = new Date(currentStart);
        if (periodType === '30_dias') {
            currentEnd.setDate(currentStart.getDate() + 29);
        } else {
            currentEnd.setMonth(currentEnd.getMonth() + 1);
            currentEnd.setDate(currentEnd.getDate() - 1);
        }
        periods.push({
            actNumber: i,
            from: currentStart.toISOString().split('T')[0],
            to: currentEnd.toISOString().split('T')[0],
            isAddition: i > Number(initialMonths)
        });
        currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate() + 1);
    }
    return periods;
}

/**
 * Downloads a file (photo or document) from Telegram's servers and saves it to uploads
 */
const downloadFileFromTelegram = async (fileId, obligationIndex, originalName, mimeType) => {
    try {
        const fileResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
        const fileData = await fileResponse.json();
        if (!fileData.ok) {
            throw new Error(`Telegram getFile error: ${fileData.description}`);
        }
        
        const filePathOnTelegram = fileData.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePathOnTelegram}`;
        
        const fileStreamResponse = await fetch(downloadUrl);
        const arrayBuffer = await fileStreamResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(originalName) || path.extname(filePathOnTelegram) || '.jpg';
        const safeName = `evidence_${obligationIndex}-${uniqueSuffix}${ext}`;
        const localPath = path.join(uploadsDir, safeName);
        
        fs.writeFileSync(localPath, buffer);
        
        return {
            filename: originalName,
            path: `uploads/${safeName}`,
            mimetype: mimeType
        };
    } catch (err) {
        console.error('❌ Error al descargar archivo de Telegram:', err.message);
        throw err;
    }
};

/**
 * Sends a text message (plain text)
 */
const sendTelegramMessage = async (chatId, text) => {
    if (!TELEGRAM_TOKEN) return;
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text
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
 * Sends a plain text message with Inline Keyboards
 */
const sendTelegramKeyboardMessage = async (chatId, text, inlineKeyboard) => {
    if (!TELEGRAM_TOKEN) return;
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined
            })
        });
        const data = await response.json();
        if (!data.ok) {
            console.error('⚠️ Error al enviar mensaje con teclado:', data.description);
        }
    } catch (err) {
        console.error('❌ Error en sendTelegramKeyboardMessage:', err.message);
    }
};

/**
 * Edits an existing message's text and/or inline keyboard (plain text)
 */
const editTelegramMessage = async (chatId, messageId, text, inlineKeyboard) => {
    if (!TELEGRAM_TOKEN) return;
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text: text,
                reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined
            })
        });
        const data = await response.json();
        if (!data.ok && !data.description.includes('message is not modified')) {
            console.error('⚠️ Error al editar mensaje Telegram:', data.description);
        }
    } catch (err) {
        console.error('❌ Error en editTelegramMessage:', err.message);
    }
};

/**
 * Sends a binary document/archive by Telegram
 */
const sendTelegramDocument = async (chatId, filePath, caption) => {
    if (!TELEGRAM_TOKEN || !fs.existsSync(filePath)) return;
    try {
        const filename = path.basename(filePath);
        const fileBuffer = fs.readFileSync(filePath);
        
        const boundary = '----TelegramBotBoundary' + Date.now().toString(16);
        const header = `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${filename}"\r\nContent-Type: application/zip\r\n\r\n`;
        const footer = `\r\n--${boundary}--\r\n`;
        
        const headerBuffer = Buffer.from(header, 'utf-8');
        const footerBuffer = Buffer.from(footer, 'utf-8');
        const multipartBody = Buffer.concat([headerBuffer, fileBuffer, footerBuffer]);

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
 * Renders the Act Selection Menu
 */
const showActsMenu = async (chatId, user, editMessageId = null) => {
    try {
        const contract = await Contract.findOne({ user: user._id });
        if (!contract) {
            const msg = '⚠️ Sin contrato configurado. Por favor, ingresa los datos primero en la plataforma web.';
            if (editMessageId) {
                await editTelegramMessage(chatId, editMessageId, msg);
            } else {
                await sendTelegramMessage(chatId, msg);
            }
            return;
        }

        const periods = calculatePeriods(
            contract.startDate,
            contract.initialDurationMonths || 4,
            contract.additionDurationMonths || 0,
            contract.periodType || 'mes_cumplido'
        );

        const existingPeriods = await BillingPeriod.find({ user: user._id });

        let text = '📂 Gestion de Evidencias\n\nSelecciona el numero de Acta de Cobro para la cual deseas cargar evidencias y comentarios:';
        const keyboard = [];

        for (const p of periods) {
            const existing = existingPeriods.find(ep => ep.actNumber === p.actNumber);
            let statusLabel = '';
            if (existing) {
                if (existing.status === 'approved') statusLabel = ' (Aprobada)';
                else if (existing.status === 'rejected') statusLabel = ' (Rechazada)';
                else statusLabel = ' (Borrador)';
            } else {
                statusLabel = ' (Sin iniciar)';
            }

            keyboard.push([{
                text: `Acta N. ${p.actNumber}${statusLabel}`,
                callback_data: `select_act_${p.actNumber}`
            }]);
        }

        if (editMessageId) {
            await editTelegramMessage(chatId, editMessageId, text, keyboard);
        } else {
            await sendTelegramKeyboardMessage(chatId, text, keyboard);
        }
    } catch (err) {
        console.error(err);
        await sendTelegramMessage(chatId, '❌ Error al cargar el menú de actas.');
    }
};

/**
 * Handles the selection of a specific Act, presenting its obligations
 */
const selectActFlow = async (chatId, user, actNumber, editMessageId = null) => {
    try {
        const contract = await Contract.findOne({ user: user._id });
        if (!contract) {
            await sendTelegramMessage(chatId, '⚠️ No se encontró tu contrato.');
            return;
        }

        const periods = calculatePeriods(
            contract.startDate,
            contract.initialDurationMonths || 4,
            contract.additionDurationMonths || 0,
            contract.periodType || 'mes_cumplido'
        );

        const periodInfo = periods.find(p => p.actNumber === actNumber);
        if (!periodInfo) {
            await sendTelegramMessage(chatId, `⚠️ El acta N. ${actNumber} no es válida para tu contrato.`);
            return;
        }

        let period = await BillingPeriod.findOne({
            user: user._id,
            actNumber: actNumber,
            status: 'pending'
        });

        if (!period) {
            period = await BillingPeriod.findOne({
                user: user._id,
                actNumber: actNumber
            });
        }

        if (!period) {
            const initialActivities = (contract.activities || []).map((text, i) => ({
                obligationCode: `2.${i + 1}`,
                obligationText: text,
                comment: '',
                evidences: []
            }));

            period = await BillingPeriod.create({
                user: user._id,
                actNumber: actNumber,
                periodFrom: new Date(periodInfo.from + 'T00:00:00'),
                periodTo: new Date(periodInfo.to + 'T23:59:59'),
                activities: initialActivities,
                status: 'pending',
                securitySocial: {
                    operator: '',
                    planillaNumber: '',
                    totalPaid: 0,
                    saludPaid: 0,
                    pensionPaid: 0,
                    arlPaid: 0,
                    period: ''
                }
            });
        }

        if (period.status === 'approved') {
            const text = `⚠️ El Acta N. ${actNumber} ya ha sido Aprobada y no se puede modificar.\n\nPor favor selecciona otra acta.`;
            const keyboard = [[{ text: 'Volver a las Actas', callback_data: 'go_back_acts' }]];
            if (editMessageId) {
                await editTelegramMessage(chatId, editMessageId, text, keyboard);
            } else {
                await sendTelegramKeyboardMessage(chatId, text, keyboard);
            }
            return;
        }

        let text = `📋 Acta N. ${actNumber}\n`;
        text += `Periodo: ${period.periodFrom.toISOString().split('T')[0]} al ${period.periodTo.toISOString().split('T')[0]}\n\n`;
        text += `Selecciona una obligación para registrar tu comentario y evidencia:\n\n`;

        const keyboard = [];
        
        if (!period.activities || period.activities.length === 0) {
            period.activities = (contract.activities || []).map((text, i) => ({
                obligationCode: `2.${i + 1}`,
                obligationText: text,
                comment: '',
                evidences: []
            }));
            await period.save();
        }

        period.activities.forEach((act, index) => {
            const hasComment = act.comment && act.comment.trim().length > 0;
            const hasEvidence = act.evidences && act.evidences.length > 0;
            const statusLabel = (hasComment && hasEvidence) ? 'OK' : (hasComment || hasEvidence) ? 'PARCIAL' : 'PENDIENTE';

            text += `[${statusLabel}] Obligación ${act.obligationCode}: ${act.obligationText.substring(0, 100)}${act.obligationText.length > 100 ? '...' : ''}\n`;
            if (hasComment) {
                text += `   Comentario: "${act.comment.substring(0, 50)}${act.comment.length > 50 ? '...' : ''}"\n`;
            }
            if (hasEvidence) {
                text += `   Archivos: (${act.evidences.length} soporte(s) cargado(s))\n`;
            }
            text += `\n`;

            keyboard.push([{
                text: `[${statusLabel}] Obligación ${act.obligationCode}`,
                callback_data: `select_obl_${index}_${period._id}`
            }]);
        });

        keyboard.push([
            { text: 'Resumen del Acta', callback_data: `summary_${period._id}` },
            { text: 'Volver', callback_data: 'go_back_acts' }
        ]);

        if (editMessageId) {
            await editTelegramMessage(chatId, editMessageId, text, keyboard);
        } else {
            await sendTelegramKeyboardMessage(chatId, text, keyboard);
        }
    } catch (err) {
        console.error(err);
        await sendTelegramMessage(chatId, '❌ Error al procesar el acta.');
    }
};

/**
 * Prepares the session state to receive a comment for the selected obligation
 */
const selectObligationFlow = async (chatId, user, periodId, index, editMessageId = null) => {
    try {
        const period = await BillingPeriod.findById(periodId);
        if (!period) {
            await sendTelegramMessage(chatId, '⚠️ Periodo no encontrado.');
            return;
        }

        const act = period.activities[index];
        if (!act) {
            await sendTelegramMessage(chatId, '⚠️ Obligación no encontrada.');
            return;
        }

        sessions.set(chatId, {
            state: 'awaiting_comment',
            periodId: periodId,
            obligationIndex: index
        });

        let text = `Obligación ${act.obligationCode}\n\n`;
        text += `${act.obligationText}\n\n`;
        
        if (act.comment) {
            text += `Comentario actual:\n"${act.comment}"\n\n`;
        }
        if (act.evidences && act.evidences.length > 0) {
            text += `Soportes actuales:\n`;
            act.evidences.forEach((ev, i) => {
                text += `   • ${i + 1}. ${ev.filename}\n`;
            });
            text += `\n`;
        }

        text += `Por favor, escribe el comentario (descripción del trabajo realizado) para esta obligación:`;

        const keyboard = [[{ text: 'Cancelar', callback_data: `select_act_${period.actNumber}` }]];

        if (editMessageId) {
            await editTelegramMessage(chatId, editMessageId, text, keyboard);
        } else {
            await sendTelegramKeyboardMessage(chatId, text, keyboard);
        }
    } catch (err) {
        console.error(err);
        await sendTelegramMessage(chatId, '❌ Error al seleccionar la obligación.');
    }
};

/**
 * Shows the completion metrics for the billing period
 */
const showPeriodSummary = async (chatId, periodId, editMessageId = null) => {
    try {
        const period = await BillingPeriod.findById(periodId);
        if (!period) {
            await sendTelegramMessage(chatId, '⚠️ Periodo no encontrado.');
            return;
        }

        const totalCount = period.activities.length;
        const readyCount = period.activities.filter(a => a.comment && a.evidences && a.evidences.length > 0).length;
        const partialCount = period.activities.filter(a => (a.comment || (a.evidences && a.evidences.length > 0)) && !(a.comment && a.evidences && a.evidences.length > 0)).length;

        let text = `Resumen de Carga - Acta N. ${period.actNumber}\n\n`;
        text += `Periodo: ${period.periodFrom.toISOString().split('T')[0]} al ${period.periodTo.toISOString().split('T')[0]}\n`;
        text += `Estado: ${period.status.toUpperCase()}\n\n`;
        text += `Avance de Obligaciones:\n`;
        text += `   Listas: ${readyCount}\n`;
        text += `   Incompletas: ${partialCount}\n`;
        text += `   Sin iniciar: ${totalCount - readyCount - partialCount}\n`;
        text += `   ───────────────\n`;
        text += `   Total: ${readyCount} de ${totalCount} obligaciones completadas\n\n`;

        if (period.securitySocial && period.securitySocial.planillaNumber) {
            text += `Seguridad Social: Registrada (Planilla ${period.securitySocial.planillaNumber})\n`;
        } else {
            text += `Seguridad Social: No registrada (Debe cargarse en el panel web)\n`;
        }

        text += `\nRecuerda que para generar tu cuenta de cobro final, debes completar todas las obligaciones y subir tu planilla de seguridad social en la plataforma web.`;

        const keyboard = [[{ text: 'Ver Obligaciones', callback_data: `select_act_${period.actNumber}` }]];

        if (editMessageId) {
            await editTelegramMessage(chatId, editMessageId, text, keyboard);
        } else {
            await sendTelegramKeyboardMessage(chatId, text, keyboard);
        }
    } catch (err) {
        console.error(err);
        await sendTelegramMessage(chatId, '❌ Error al cargar el resumen.');
    }
};

/**
 * Main handler for callback query updates (Inline buttons)
 */
const handleCallbackQuery = async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id.toString();
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQuery.id })
        });
    } catch (_) {}

    const user = await User.findOne({ telegramChatId: chatId });
    if (!user) {
        await sendTelegramMessage(chatId, '⚠️ Tu cuenta no esta asociada. Genera el codigo en la web y envialo aqui.');
        return;
    }

    if (data === 'go_back_acts') {
        sessions.set(chatId, { state: 'idle' });
        await showActsMenu(chatId, user, messageId);
    } else if (data.startsWith('select_act_')) {
        const actNumber = parseInt(data.replace('select_act_', ''), 10);
        await selectActFlow(chatId, user, actNumber, messageId);
    } else if (data.startsWith('select_obl_')) {
        const parts = data.split('_');
        const index = parseInt(parts[2], 10);
        const periodId = parts[3];
        await selectObligationFlow(chatId, user, periodId, index, messageId);
    } else if (data.startsWith('summary_')) {
        const periodId = data.replace('summary_', '');
        await showPeriodSummary(chatId, periodId, messageId);
    } else if (data === 'download_zip') {
        const user = await User.findOne({ telegramChatId: chatId });
        if (!user) {
            await sendTelegramMessage(chatId, '⚠️ Cuenta no vinculada. Envía un saludo (hola) para identificarte con tu cédula.');
            return;
        }
        const billingPeriod = await BillingPeriod.findOne({ user: user._id }).sort({ createdAt: -1 });
        if (!billingPeriod) {
            await sendTelegramMessage(chatId, '📭 Aún no tienes periodos registrados en el sistema.');
            return;
        }
        if (billingPeriod.zipPath && fs.existsSync(billingPeriod.zipPath)) {
            await sendTelegramMessage(chatId, `📦 Generando tu paquete de cobro para el acta número ${billingPeriod.actNumber}...`);
            await sendTelegramDocument(chatId, billingPeriod.zipPath, `Paquete de Cobro - Acta ${billingPeriod.actNumber}`);
        } else {
            await sendTelegramMessage(chatId, `⚠️ Tu cuenta está en estado "${billingPeriod.status === 'pending' ? 'Pendiente' : 'Borrador'}" pero el archivo comprimido aún no ha sido generado desde la web.`);
        }
    }
};

/**
 * Checks if incoming text is a greeting
 */
function isGreeting(str) {
    if (!str) return false;
    const clean = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return /^(hola|buen\s*dia|buenos\s*dias|buenas\s*tardes|buenas\s*noches|buenas|saludos|que\s*tal|hi|hello|alo)(\s.*|[!.,;:]*)?$/i.test(clean);
}

/**
 * Processes incoming chat messages from the user
 */
const handleIncomingMessage = async (message) => {
    const chatId = message.chat.id.toString();
    const text = (message.text || '').trim();
    const session = sessions.get(chatId);

    if (text === '/cancelar' || text.toLowerCase() === 'cancelar' || text === '/cancel') {
        sessions.delete(chatId);
        await sendTelegramMessage(chatId, '❌ Operacion cancelada. Sesion reiniciada.');
        return;
    }

    // GREETING DETECTION: "hola", "Hola", "buen dia", "buenos dias", etc.
    if (isGreeting(text)) {
        sessions.set(chatId, { state: 'awaiting_identification' });
        await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
        return;
    }

    // If awaiting identification (cédula)
    if (session && session.state === 'awaiting_identification') {
        const inputCedula = text.replace(/\D/g, '');
        if (!inputCedula || inputCedula.length < 5) {
            await sendTelegramMessage(chatId, '⚠️ Por favor, envíame tu número de documento de identidad en solo dígitos (sin puntos ni letras):');
            return;
        }

        const allContracts = await Contract.find().populate('user');
        const contract = allContracts.find(c => (c.idNumber || '').replace(/\D/g, '') === inputCedula);

        if (contract) {
            const user = contract.user;
            if (user) {
                user.telegramChatId = chatId;
                user.telegramVerificationCode = null;
                await user.save();
            }

            sessions.set(chatId, {
                state: 'identified',
                cedula: inputCedula,
                contractId: contract._id,
                userId: user ? user._id : null
            });

            const contractorName = contract.contractorName || (user ? user.fullName : 'Funcionario / Contratista');
            let reply = `✅ ¡Identidad confirmada en el sistema!\n\n`;
            reply += `👤 Funcionario: ${contractorName}\n`;
            reply += `🪪 Cédula: ${contract.idNumber || inputCedula}\n`;
            reply += `📋 Contrato: ${contract.contractNumber || 'En trámite'}\n`;
            reply += `🏛️ Dependencia: ${contract.supervisorDependency || 'Alcaldía de Armenia'}\n\n`;
            reply += `Tu usuario ha sido verificado con éxito en la base de datos.\n`;
            reply += `¿Qué deseas realizar?`;

            await sendTelegramKeyboardMessage(chatId, reply, [
                [{ text: '📂 Cargar Evidencias (/subir)', callback_data: 'go_back_acts' }],
                [{ text: '📦 Descargar Paquete ZIP (/descargar)', callback_data: 'download_zip' }]
            ]);
        } else {
            await sendTelegramMessage(chatId, `❌ El documento de identidad "${inputCedula}" no fue encontrado en la base de datos de contratistas.\n\nPor favor verifica el número e inténtalo de nuevo, o regístrate en la plataforma web.\n\n(Escribe /cancelar para detener)`);
        }
        return;
    }

    // Direct Cédula Detection (if user directly types their ID number without greeting first)
    const numericOnly = text.replace(/\D/g, '');
    const isOnlyDigitsAndDots = /^[\d.\s]+$/.test(text);
    if (!session && isOnlyDigitsAndDots && numericOnly.length >= 6 && numericOnly.length <= 11) {
        const allContracts = await Contract.find().populate('user');
        const contract = allContracts.find(c => (c.idNumber || '').replace(/\D/g, '') === numericOnly);

        if (contract) {
            const user = contract.user;
            if (user) {
                user.telegramChatId = chatId;
                user.telegramVerificationCode = null;
                await user.save();
            }

            sessions.set(chatId, {
                state: 'identified',
                cedula: numericOnly,
                contractId: contract._id,
                userId: user ? user._id : null
            });

            const contractorName = contract.contractorName || (user ? user.fullName : 'Funcionario / Contratista');
            let reply = `✅ ¡Identidad confirmada en el sistema!\n\n`;
            reply += `👤 Funcionario: ${contractorName}\n`;
            reply += `🪪 Cédula: ${contract.idNumber || numericOnly}\n`;
            reply += `📋 Contrato: ${contract.contractNumber || 'En trámite'}\n`;
            reply += `🏛️ Dependencia: ${contract.supervisorDependency || 'Alcaldía de Armenia'}\n\n`;
            reply += `Tu usuario ha sido verificado con éxito en la base de datos.`;

            await sendTelegramKeyboardMessage(chatId, reply, [
                [{ text: '📂 Cargar Evidencias (/subir)', callback_data: 'go_back_acts' }],
                [{ text: '📦 Descargar Paquete ZIP (/descargar)', callback_data: 'download_zip' }]
            ]);
            return;
        }
    }

    if (session) {
        if (session.state === 'awaiting_link_cedula') {
            const inputCedula = text.replace(/\D/g, '');
            if (!inputCedula) {
                await sendTelegramMessage(chatId, '⚠️ Escribe un numero de cedula valido (solo digitos):');
                return;
            }

            const tempUser = session.tempUser;
            const contract = await Contract.findOne({ user: tempUser._id });

            if (!contract) {
                sessions.delete(chatId);
                await sendTelegramMessage(chatId, '⚠️ Falta configurar el contrato en la web. Asociacion cancelada.');
                return;
            }

            const contractCedula = (contract.idNumber || '').replace(/\D/g, '');

            if (inputCedula === contractCedula) {
                tempUser.telegramChatId = chatId;
                tempUser.telegramVerificationCode = null;
                await tempUser.save();

                sessions.delete(chatId);

                await sendTelegramMessage(chatId, `🎉 Hola ${tempUser.fullName}. Tu cuenta ha sido asociada de forma exitosa.\n\nEscribe /subir para reportar evidencias o /descargar para el comprimido ZIP.`);
            } else {
                await sendTelegramMessage(chatId, `❌ La cedula no coincide con los datos del contrato.\n\nEscribe el numero correcto o escribe /cancelar para abortar.`);
            }
            return;
        }

        if (session.state === 'awaiting_comment') {
            if (!text) {
                await sendTelegramMessage(chatId, '⚠️ Escribe un comentario descriptivo en formato de texto:');
                return;
            }

            session.comment = text;
            session.state = 'awaiting_file';
            sessions.set(chatId, session);

            const period = await BillingPeriod.findById(session.periodId);
            const act = period ? period.activities[session.obligationIndex] : null;
            const oblCode = act ? act.obligationCode : '';

            await sendTelegramKeyboardMessage(chatId, `📥 Comentario guardado para la Obligacion ${oblCode}:\n"${text}"\n\nAhora, envia el soporte (foto, PDF o Word/Excel):\n\n(Usa /cancelar para detener)`, [
                [{ text: 'Cancelar', callback_data: `select_act_${period ? period.actNumber : 1}` }]
            ]);
            return;
        }

        if (session.state === 'awaiting_file') {
            let fileId = null;
            let originalName = '';
            let mimeType = '';

            if (message.photo && message.photo.length > 0) {
                const photo = message.photo[message.photo.length - 1];
                fileId = photo.file_id;
                originalName = `evidencia_${Date.now()}.jpg`;
                mimeType = 'image/jpeg';
            } else if (message.document) {
                fileId = message.document.file_id;
                originalName = message.document.file_name || `evidencia_${Date.now()}`;
                mimeType = message.document.mime_type || 'application/octet-stream';
            }

            if (!fileId) {
                await sendTelegramMessage(chatId, '⚠️ Adjunta un archivo valido (foto o documento). Si quieres abortar, envia /cancelar.');
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Descargando soporte y guardando...');

            try {
                const fileInfo = await downloadFileFromTelegram(fileId, session.obligationIndex, originalName, mimeType);

                const period = await BillingPeriod.findById(session.periodId);
                if (period && period.activities && period.activities[session.obligationIndex]) {
                    period.activities[session.obligationIndex].comment = session.comment;
                    
                    if (!period.activities[session.obligationIndex].evidences) {
                        period.activities[session.obligationIndex].evidences = [];
                    }
                    
                    period.activities[session.obligationIndex].evidences.push(fileInfo);
                    await period.save();

                    sessions.set(chatId, { state: 'idle', periodId: period._id });

                    await sendTelegramKeyboardMessage(chatId, `🎉 Evidencia guardada exitosamente en el Acta N. ${period.actNumber} para la Obligacion ${period.activities[session.obligationIndex].obligationCode}.`, [
                        [
                            { text: 'Ver Obligaciones', callback_data: `select_act_${period.actNumber}` },
                            { text: 'Resumen del Acta', callback_data: `summary_${period._id}` }
                        ]
                    ]);
                } else {
                    throw new Error('Estructura de periodo no valida.');
                }
            } catch (err) {
                console.error(err);
                await sendTelegramMessage(chatId, `❌ Error al subir la evidencia: ${err.message}. Reintenta o envia /cancelar.`);
            }
            return;
        }
    }

    if (text.startsWith('/start')) {
        const parts = text.split(' ');
        if (parts.length > 1) {
            const code = parts[1].trim();
            const user = await User.findOne({ telegramVerificationCode: code });
            if (user) {
                sessions.set(chatId, {
                    state: 'awaiting_link_cedula',
                    tempUser: user
                });
                await sendTelegramMessage(chatId, `👋 Hola ${user.fullName}.\n\nCodigo recibido. Por seguridad, escribe tu numero de cedula registrado en el contrato para confirmar tu identidad:`);
            } else {
                await sendTelegramMessage(chatId, `❌ El codigo "${code}" es invalido o ya expiro.`);
            }
        } else {
            await sendTelegramMessage(chatId, `👋 Hola. Para asociar este bot, copia el codigo de tu panel web y envialo asi: /start [codigo]`);
        }
    } else if (text === '/subir' || text.toLowerCase() === 'subir') {
        const user = await User.findOne({ telegramChatId: chatId });
        if (!user) {
            await sendTelegramMessage(chatId, '⚠️ Tu cuenta no esta asociada. Copia el codigo en la web y envialo aqui con el comando /start.');
            return;
        }
        await showActsMenu(chatId, user);
    } else if (text === '/descargar' || text.toLowerCase() === 'descargar' || text.toLowerCase() === 'cuenta') {
        const user = await User.findOne({ telegramChatId: chatId });
        if (!user) {
            await sendTelegramMessage(chatId, '⚠️ Cuenta no vinculada. Registrate primero usando /start.');
            return;
        }

        const billingPeriod = await BillingPeriod.findOne({ user: user._id }).sort({ createdAt: -1 });

        if (!billingPeriod) {
            await sendTelegramMessage(chatId, '📭 Aún no tienes periodos registrados en el sistema.');
            return;
        }

        if (billingPeriod.zipPath && fs.existsSync(billingPeriod.zipPath)) {
            await sendTelegramMessage(chatId, `📦 Generando tu paquete de cobro para el acta número ${billingPeriod.actNumber}...`);
            await sendTelegramDocument(chatId, billingPeriod.zipPath, `Paquete de Cobro - Acta ${billingPeriod.actNumber}`);
        } else {
            await sendTelegramMessage(chatId, `⚠️ Tu cuenta del mes está registrada con estado "${billingPeriod.status === 'pending' ? 'Pendiente' : 'Borrador'}" pero el archivo comprimido aún no está listo.\n\nPor favor genera el paquete desde la aplicación web o espera la aprobación del supervisor.`);
        }
    } else {
        await sendTelegramMessage(chatId, `🤖 Bot de FormatosCuentas\n\nComandos:\n• /subir - Cargar evidencias y comentarios.\n• /descargar - Obtener paquete en ZIP.\n• /cancelar - Reiniciar flujo.\n\nSi requieres soporte, contacta al administrador.`);
    }
};

/**
 * Long Polling loop to listen to Telegram Bot updates in the background
 */
const startTelegramPolling = async () => {
    if (isPolling) return;
    isPolling = true;

    console.log('🤖 Iniciando servicio de Telegram Bot (Polling con Inline Keyboards)...');

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
                    } else if (update.callback_query) {
                        try {
                            await handleCallbackQuery(update.callback_query);
                        } catch (err) {
                            console.error('❌ Error procesando callback de Telegram:', err.message);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('⚠️ Error de conexión en Telegram Polling:', err.message);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }

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

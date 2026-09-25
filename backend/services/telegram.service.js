const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Contract = require('../models/Contract');
const BillingPeriod = require('../models/BillingPeriod');
const geminiService = require('./gemini.service');
const { generateBillingPackage } = require('../controllers/billing.controller');
const { calculatePeriods, filterSpecificObligations, isGeneralObligation, getContractDurationText } = require('../utils/period.utils');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let lastUpdateId = 0;
let isPolling = false;

// Map to manage user sessions in memory
const sessions = new Map();

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
 * Helper to extract fileId, originalName, and mimeType from an incoming Telegram message
 */
function extractTelegramFile(message) {
    if (message.document) {
        return {
            fileId: message.document.file_id,
            originalName: message.document.file_name || `document_${Date.now()}.pdf`,
            mimeType: message.document.mime_type || 'application/pdf'
        };
    }
    if (message.photo && message.photo.length > 0) {
        const photo = message.photo[message.photo.length - 1];
        return {
            fileId: photo.file_id,
            originalName: `photo_${Date.now()}.jpg`,
            mimeType: 'image/jpeg'
        };
    }
    return null;
}

/**
 * Generic downloader for any Telegram media file to the uploads directory
 */
const downloadTelegramMedia = async (fileId, prefix = 'doc', originalName = '', mimeType = '') => {
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
        const ext = path.extname(originalName) || path.extname(filePathOnTelegram) || '.pdf';
        const safeName = `${prefix}_${uniqueSuffix}${ext}`;
        const localPath = path.join(uploadsDir, safeName);
        
        fs.writeFileSync(localPath, buffer);
        
        return {
            filename: originalName || safeName,
            relativePath: `uploads/${safeName}`,
            absolutePath: localPath,
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
        const ext = path.extname(filename).toLowerCase();
        let mime = 'application/octet-stream';
        if (ext === '.zip') mime = 'application/zip';
        else if (ext === '.docx') mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (ext === '.pdf') mime = 'application/pdf';

        const header = `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`;
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
 * Generates all 4 Word docs + ZIP package and sends it via Telegram
 */
const handleGenerateAndDownload = async (chatId, user, periodId) => {
    try {
        await sendTelegramMessage(chatId, '⚙️ Generando tus 4 formatos oficiales (Informe de Actividades, Certificación del Supervisor, Retención en la Fuente, Estampillas) y empaquetando soportes...');

        const { period, zipPath } = await generateBillingPackage(periodId, user._id);

        if (zipPath && fs.existsSync(zipPath)) {
            await sendTelegramMessage(chatId, `📦 ¡Paquete de Cobro generado con éxito para el Acta N° ${period.actNumber}! Enviando archivo ZIP...`);
            await sendTelegramDocument(chatId, zipPath, `Cuenta de Cobro - Acta ${period.actNumber}`);

            await sendTelegramKeyboardMessage(chatId, `✅ Paquete de Cobro entregado en formato ZIP.\n\nContiene los 4 formatos oficiales en Word (.docx) con sus anexos y fotos organizadas, listos para ser editados o modificados desde tu computador.`, [
                [{ text: '📊 Volver al Resumen del Acta', callback_data: `summary_${period._id}` }],
                [{ text: '📁 Ver Menú de Actas', callback_data: 'show_acts_menu' }]
            ]);
        } else {
            await sendTelegramMessage(chatId, '❌ No se pudo encontrar el archivo ZIP generado. Por favor intenta de nuevo.');
        }
    } catch (err) {
        console.error('Error generando paquete desde Telegram:', err);
        await sendTelegramMessage(chatId, `❌ Error al generar los documentos: ${err.message}`);
    }
};

/**
 * Renders the Act Selection Menu
 */
const showActsMenu = async (chatId, user, editMessageId = null) => {
    try {
        const contract = await Contract.findOne({ user: user._id });
        if (!contract) {
            const msg = '⚠️ Sin contrato configurado. Puedes enviar los documentos de tu contrato escribiendo /documentos para comenzar.';
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
            contract.periodType || 'mes_cumplido',
            contract.endDate
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
            contract.periodType || 'mes_cumplido',
            contract.endDate
        );

        let periodInfo = periods.find(p => p.actNumber === actNumber);
        if (!periodInfo) {
            const now = new Date();
            const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
            periodInfo = { actNumber, from, to, isAddition: false };
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

        const buildInitialActivities = () => {
            const specificObligations = filterSpecificObligations(contract.activities || []);
            return specificObligations.map((text, i) => {
                const codeMatch = text.match(/^(\d+(\.\d+)*)\.?\s*(.*)$/);
                return {
                    obligationCode: codeMatch ? codeMatch[1] : `2.2.${i + 1}`,
                    obligationText: codeMatch ? codeMatch[3] : text,
                    comment: '',
                    evidences: []
                };
            });
        };

        if (!period) {
            period = await BillingPeriod.create({
                user: user._id,
                actNumber: actNumber,
                periodFrom: new Date(periodInfo.from + 'T00:00:00'),
                periodTo: new Date(periodInfo.to + 'T23:59:59'),
                activities: buildInitialActivities(),
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

        if (!period.activities || period.activities.length === 0) {
            period.activities = buildInitialActivities();
            if (period.activities.length > 0) {
                await period.save();
            }
        } else {
            // Filtrar para que solo queden obligaciones específicas
            const onlySpecific = period.activities.filter(act => !isGeneralObligation(act.obligationText));
            if (onlySpecific.length > 0 && onlySpecific.length < period.activities.length) {
                period.activities = onlySpecific;
                await period.save();
            }
        }

        if (!period.activities || period.activities.length === 0) {
            const emptyMsg = '⚠️ Tu contrato aún no tiene obligaciones registradas en el sistema.\n\nPuedes subir la minuta de tu contrato escribiendo /documentos para extraerlas automáticamente.';
            if (editMessageId) {
                await editTelegramMessage(chatId, editMessageId, emptyMsg);
            } else {
                await sendTelegramMessage(chatId, emptyMsg);
            }
            return;
        }

        const fromStr = period.periodFrom ? period.periodFrom.toISOString().split('T')[0] : periodInfo.from;
        const toStr = period.periodTo ? period.periodTo.toISOString().split('T')[0] : periodInfo.to;

        let text = `📋 ¿Para cuál obligación es a la que se le va a subir dicha evidencia?\n\n`;
        text += `Acta de Cobro N. ${actNumber} (Periodo: ${fromStr} al ${toStr})\n`;
        text += `──────────────────────\n`;
        text += `Lista de obligaciones de tu contrato/minuta:\n\n`;

        const keyboard = [];

        period.activities.forEach((act, index) => {
            const num = index + 1;
            const hasComment = act.comment && act.comment.trim().length > 0;
            const hasEvidence = act.evidences && act.evidences.length > 0;
            const statusEmoji = (hasComment && hasEvidence) ? '✅' : (hasComment || hasEvidence) ? '⚠️' : '⏳';
            const oblCode = act.obligationCode || `2.2.${num}`;

            text += `${statusEmoji} Obligación ${num} (${oblCode}):\n`;
            text += `"${act.obligationText}"\n`;
            if (hasComment) {
                text += `   📝 Comentario: "${act.comment.substring(0, 50)}${act.comment.length > 50 ? '...' : ''}"\n`;
            }
            if (hasEvidence) {
                text += `   📎 Soportes: (${act.evidences.length} archivo(s))\n`;
            }
            text += `\n`;

            keyboard.push([{
                text: `${statusEmoji} ${num}. Obligación ${oblCode}`,
                callback_data: `select_obl_${index}_${period._id}`
            }]);
        });

        keyboard.push([
            { text: '🏥 Subir Planilla SS', callback_data: `upload_planilla_${period._id}` },
            { text: '📊 Resumen del Acta', callback_data: `summary_${period._id}` }
        ]);
        keyboard.push([
            { text: '📁 Cambiar de Acta', callback_data: 'show_acts_menu' }
        ]);

        text += `👉 Toca el botón de la obligación o escribe su número (ej: 1, 2, 3...):`;

        sessions.set(chatId, {
            state: 'awaiting_obligation_selection',
            periodId: period._id,
            actNumber: actNumber
        });

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
 * Resolves current active act and presents obligations
 */
const showObligationsFlow = async (chatId, user, editMessageId = null, forcedActNumber = null) => {
    let actNumber = forcedActNumber;
    if (!actNumber) {
        const activePeriod = await BillingPeriod.findOne({ user: user._id, status: 'pending' }).sort({ actNumber: 1 });
        actNumber = activePeriod ? activePeriod.actNumber : 1;
    }
    await selectActFlow(chatId, user, actNumber, editMessageId);
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

        let text = `📌 Obligación ${index + 1} (${act.obligationCode}):\n\n`;
        text += `"${act.obligationText}"\n\n`;
        
        if (act.comment) {
            text += `📝 Comentario actual:\n"${act.comment}"\n\n`;
        }
        if (act.evidences && act.evidences.length > 0) {
            text += `📎 Soportes actuales (${act.evidences.length}):\n`;
            act.evidences.forEach((ev, i) => {
                text += `   • ${i + 1}. ${ev.filename}\n`;
            });
            text += `\n`;
        }

        text += `Por favor, escribe el comentario (descripción de las actividades realizadas) para esta obligación, el cual se incluirá directamente en tu Informe de Actividades:`;

        const keyboard = [];
        if (act.comment) {
            keyboard.push([{ text: '📸 Solo adjuntar soporte (mantener texto)', callback_data: `quick_add_ev_${index}_${periodId}` }]);
        }
        keyboard.push([{ text: '⬅️ Volver a Obligaciones', callback_data: `select_act_${period.actNumber}` }]);

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
            const paidStr = period.securitySocial.totalPaid ? ` - $${Number(period.securitySocial.totalPaid).toLocaleString('es-CO')}` : '';
            text += `Seguridad Social: Registrada (Planilla ${period.securitySocial.planillaNumber}${paidStr})\n`;
        } else {
            text += `Seguridad Social: No registrada (Puedes subirla directamente por aquí)\n`;
        }

        const hasPlanilla = !!(period.securitySocial && (period.securitySocial.planillaNumber || period.securitySocialPath));
        const allObligationsReady = totalCount > 0 && readyCount === totalCount;
        const isComplete = allObligationsReady && hasPlanilla;

        const keyboard = [];

        if (isComplete) {
            text += `\n🎉 ¡Felicidades! Has completado todas las ${totalCount} obligaciones y tu planilla de seguridad social está registrada con éxito.\n\n`;
            text += `Tu cuenta de cobro para el Acta N. ${period.actNumber} está 100% lista. Toca el botón abajo para generar y descargar tu paquete completo en archivo ZIP (incluye los 4 formatos oficiales en Word listos para editar desde tu PC y todos los soportes):`;

            keyboard.push([
                { text: '📦 Descargar Paquete de Cobro (ZIP)', callback_data: `generate_and_download_${period._id}` }
            ]);
        } else {
            const missing = [];
            if (readyCount < totalCount) missing.push(`${totalCount - readyCount} obligación(es) pendiente(s)`);
            if (!hasPlanilla) missing.push('la planilla de seguridad social');
            text += `\n⏳ Recuerda que para generar tu cuenta de cobro final, debes completar: ${missing.join(' y ')}.`;
        }

        keyboard.push([
            { text: period.securitySocial?.planillaNumber ? '🔄 Actualizar Planilla SS' : '🏥 Subir Planilla SS', callback_data: `upload_planilla_${period._id}` },
            { text: '📋 Ver Obligaciones', callback_data: `select_act_${period.actNumber}` }
        ]);
        keyboard.push([
            { text: '📁 Cambiar de Acta', callback_data: 'show_acts_menu' }
        ]);

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
 * Starts the sequential document collection flow (Step 1: Minuta)
 */
const startContractDocsFlow = async (chatId, user) => {
    sessions.set(chatId, {
        state: 'awaiting_doc_minuta',
        userId: user._id
    });

    let text = `📄 Paso 1 de 6: Minuta del Contrato (PDF)\n\n`;
    text += `Por favor, adjunta el archivo PDF de la minuta de tu contrato.\n`;
    text += `La Inteligencia Artificial extraerá automáticamente el número de contrato, objeto, valor, supervisor y la lista de tus obligaciones contractuales.\n\n`;
    text += `💡 Si no lo tienes a la mano en este momento, puedes escribir "saltar" o presionar el botón abajo:`;

    await sendTelegramKeyboardMessage(chatId, text, [
        [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_minuta' }]
    ]);
};

/**
 * Step 2: Prompts user for Acta de Inicio
 */
const promptActaInicio = async (chatId, user) => {
    sessions.set(chatId, {
        state: 'awaiting_doc_acta_inicio',
        userId: user._id
    });

    let text = `📑 Paso 2 de 6: Acta de Inicio (PDF)\n\n`;
    text += `Por favor, adjunta el archivo PDF del Acta de Inicio de tu contrato.\n`;
    text += `La IA extraerá la fecha oficial de inicio para calcular exactamente los periodos de tus cuentas de cobro.\n\n`;
    text += `💡 Puedes escribir "saltar" o presionar el botón abajo si no la tienes a la mano:`;

    await sendTelegramKeyboardMessage(chatId, text, [
        [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_acta' }]
    ]);
};

/**
 * Step 3: Prompts user for Registro Presupuestal (RP)
 */
const promptRp = async (chatId, user) => {
    sessions.set(chatId, {
        state: 'awaiting_doc_rp',
        userId: user._id
    });

    let text = `📊 Paso 3 de 6: Registro Presupuestal - RP (PDF)\n\n`;
    text += `Por favor, adjunta el PDF del Registro Presupuestal (RP).\n`;
    text += `La IA extraerá el número de RP, CDP y el Rubro presupuestal asignado a tu contrato.\n\n`;
    text += `💡 Puedes escribir "saltar" o presionar el botón abajo si no lo tienes a la mano:`;

    await sendTelegramKeyboardMessage(chatId, text, [
        [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_rp' }]
    ]);
};

/**
 * Step 4: Prompts user for RUT
 */
const promptRut = async (chatId, user) => {
    sessions.set(chatId, {
        state: 'awaiting_doc_rut',
        userId: user._id
    });

    let text = `📑 Paso 4 de 6: RUT - Registro Único Tributario (PDF)\n\n`;
    text += `Por favor, adjunta el PDF de tu RUT de la DIAN actualizado.\n`;
    text += `La IA extraerá tu dirección fiscal, ciudad y condición tributaria (si declaras renta o no).\n\n`;
    text += `💡 Puedes escribir "saltar" o presionar el botón abajo si no lo tienes a la mano:`;

    await sendTelegramKeyboardMessage(chatId, text, [
        [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_rut' }]
    ]);
};

/**
 * Step 5: Prompts user for Certificación Bancaria
 */
const promptBank = async (chatId, user) => {
    sessions.set(chatId, {
        state: 'awaiting_doc_bank',
        userId: user._id
    });

    let text = `🏦 Paso 5 de 6: Certificación Bancaria (PDF o Imagen)\n\n`;
    text += `Por favor, adjunta tu certificación bancaria (en lo posible la misma suministrada en el SISCAR).\n`;
    text += `La IA extraerá el banco, número de cuenta y tipo de cuenta (Ahorros / Corriente).\n\n`;
    text += `💡 Puedes escribir "saltar" o presionar el botón abajo si no la tienes a la mano:`;

    await sendTelegramKeyboardMessage(chatId, text, [
        [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_bank' }]
    ]);
};

/**
 * Step 6: Prompts user for Planilla de Seguridad Social
 */
const promptSecuritySocial = async (chatId, user) => {
    sessions.set(chatId, {
        state: 'awaiting_doc_planilla',
        userId: user._id
    });

    let text = `🏥 Paso 6 de 6: Planilla de Seguridad Social (PDF o Imagen)\n\n`;
    text += `Por favor, adjunta el PDF o imagen de tu planilla de pago de aportes (PILA).\n`;
    text += `La Inteligencia Artificial extraerá automáticamente el operador, número de planilla, periodo cotizado y los valores de aportes pagados.\n\n`;
    text += `💡 Puedes escribir "saltar" o presionar el botón abajo si no la tienes a la mano:`;

    await sendTelegramKeyboardMessage(chatId, text, [
        [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_planilla' }]
    ]);
};

/**
 * Prompts user for Planilla de Seguridad Social for a specific BillingPeriod (Acta)
 */
const promptPeriodPlanilla = async (chatId, periodId) => {
    try {
        const period = await BillingPeriod.findById(periodId);
        if (!period) {
            await sendTelegramMessage(chatId, '⚠️ Periodo no encontrado.');
            return;
        }

        sessions.set(chatId, {
            state: 'awaiting_period_planilla',
            periodId: period._id,
            actNumber: period.actNumber
        });

        const fromStr = period.periodFrom ? period.periodFrom.toISOString().split('T')[0] : '';
        const toStr = period.periodTo ? period.periodTo.toISOString().split('T')[0] : '';
        const periodRange = (fromStr && toStr) ? ` (${fromStr} al ${toStr})` : '';

        let text = `🏥 Carga de Planilla de Seguridad Social\nActa de Cobro N. ${period.actNumber}${periodRange}\n\n`;
        text += `Por favor, adjunta el archivo PDF o foto de tu planilla de pago de aportes (PILA) correspondiente a este periodo.\n\n`;
        text += `La Inteligencia Artificial extraerá automáticamente:\n`;
        text += `• Operador (SIMPLE, SOI, Mi Planilla, etc.)\n`;
        text += `• Número de planilla\n`;
        text += `• Periodo de cotización\n`;
        text += `• Aportes a Salud, Pensión, ARL y Total Pagado\n\n`;
        text += `💡 Envía el archivo ahora o presiona cancelar para volver:`;

        await sendTelegramKeyboardMessage(chatId, text, [
            [{ text: '❌ Cancelar', callback_data: `summary_${period._id}` }]
        ]);
    } catch (err) {
        console.error('Error en promptPeriodPlanilla:', err);
        await sendTelegramMessage(chatId, '❌ Error al solicitar la planilla.');
    }
};

/**
 * Finish documents collection flow and present contract summary card
 */
const finishDocsFlow = async (chatId, user) => {
    try {
        const contract = await Contract.findOne({ user: user._id });
        sessions.set(chatId, {
            state: 'identified',
            userId: user._id,
            contractId: contract ? contract._id : null,
            cedula: contract ? contract.idNumber : ''
        });

        const oblCount = (contract && contract.activities) ? contract.activities.length : 0;
        let summaryMsg = `🎉 ¡Carga y procesamiento de documentos finalizada!\n\n`;
        summaryMsg += `📋 Resumen de tu Contrato:\n`;
        summaryMsg += `• Funcionario: ${contract ? (contract.contractorName || user.fullName) : user.fullName}\n`;
        summaryMsg += `• Cédula: ${contract ? (contract.idNumber || 'N/A') : 'N/A'}\n`;
        summaryMsg += `• Contrato N°: ${contract && contract.contractNumber ? contract.contractNumber : 'Pendiente'}\n`;
        summaryMsg += `• Fecha Inicio: ${contract && contract.startDate ? contract.startDate.split('T')[0] : 'Pendiente'}\n`;
        summaryMsg += `• Fecha Fin: ${contract && contract.endDate ? contract.endDate.split('T')[0] : 'Pendiente'}\n`;
        summaryMsg += `• Plazo / Duración: ${getContractDurationText(contract)}\n`;
        summaryMsg += `• RP: ${contract && contract.rp ? contract.rp : 'Pendiente'} | CDP: ${contract && contract.cdp ? contract.cdp : 'Pendiente'}\n`;
        summaryMsg += `• Rubro: ${contract && contract.rubro ? contract.rubro : 'Pendiente'}\n`;
        summaryMsg += `• Banco: ${contract && contract.bankName ? contract.bankName : 'Pendiente'} (${contract && contract.accountNumber ? contract.accountNumber : ''})\n`;
        summaryMsg += `• Dirección Fiscal: ${contract && contract.contractorAddress ? contract.contractorAddress : 'Pendiente'}\n`;
        summaryMsg += `• Declarante de Renta: ${contract && contract.isTaxFiler ? 'Sí' : 'No'}\n`;
        summaryMsg += `• Seguridad Social: ${contract && contract.securitySocialPath ? 'Cargada' : 'Pendiente'}\n`;
        summaryMsg += `• Obligaciones contractuales: ${oblCount} registradas\n\n`;

        if (oblCount > 0) {
            summaryMsg += `¿Deseas comenzar a cargar las evidencias y comentarios para tu informe de actividades?`;
        } else {
            summaryMsg += `⚠️ No se detectaron obligaciones en la minuta (o se omitió el documento). Podrás volver a subir los documentos escribiendo /documentos.`;
        }

        await sendTelegramKeyboardMessage(chatId, summaryMsg, [
            [{ text: '📂 Subir Evidencia', callback_data: 'subir_evidencia' }],
            [{ text: '🏥 Subir Planilla SS', callback_data: 'quick_upload_planilla' }],
            [{ text: '📊 Resumen del Acta', callback_data: 'show_acts_menu' }],
            [{ text: '📦 Descargar Paquete ZIP', callback_data: 'download_zip' }]
        ]);
    } catch (err) {
        console.error('Error en finishDocsFlow:', err);
        await sendTelegramMessage(chatId, '❌ Error al finalizar la configuración de documentos.');
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

    // Public / Registration callbacks (no existing user required)
    if (data === 'start_registration') {
        const session = sessions.get(chatId);
        const cedula = session?.tempCedula || '';
        sessions.set(chatId, {
            state: 'reg_step_name',
            regData: { cedula }
        });
        await sendTelegramMessage(chatId, '📝 Paso 1 de 5: Nombre Completo\n\nPor favor, escribe tus nombres y apellidos completos:');
        return;
    } else if (data === 'cancel_registration') {
        sessions.delete(chatId);
        await sendTelegramMessage(chatId, '❌ Registro cancelado. Si deseas iniciar nuevamente en cualquier momento, escribe "hola" o /start.');
        return;
    } else if (data === 'confirm_cedula') {
        const session = sessions.get(chatId);
        if (session && session.state === 'reg_step_cedula') {
            session.state = 'reg_step_entity';
            sessions.set(chatId, session);
            await sendTelegramMessage(chatId, `🏛️ Paso 3 de 5: Entidad o Dependencia\n\n¿A qué secretaría, dependencia o entidad perteneces?\n(Ejemplo: Secretaría TIC, Secretaría de Hacienda, Secretaría de Educación, Alcaldía de Armenia):`);
            return;
        }
    }

    let user = await User.findOne({ telegramChatId: chatId });
    if (!user) {
        const session = sessions.get(chatId);
        if (session && session.userId) {
            user = await User.findById(session.userId);
        }
    }

    // Document flow callbacks
    if (data === 'start_docs_flow') {
        if (user) {
            await startContractDocsFlow(chatId, user);
        } else {
            await sendTelegramMessage(chatId, '⚠️ Por favor saluda con "hola" para identificarte primero.');
        }
        return;
    } else if (data === 'skip_docs_flow') {
        sessions.set(chatId, { state: 'idle' });
        await sendTelegramMessage(chatId, '👍 Entendido. Cuando desees cargar los documentos de tu contrato, escribe "documentos" o "hola".');
        return;
    } else if (data === 'skip_doc_minuta') {
        await sendTelegramMessage(chatId, '⏩ Minuta omitida.');
        if (user) await promptActaInicio(chatId, user);
        return;
    } else if (data === 'skip_doc_acta') {
        await sendTelegramMessage(chatId, '⏩ Acta de Inicio omitida.');
        if (user) await promptRp(chatId, user);
        return;
    } else if (data === 'skip_doc_rp') {
        await sendTelegramMessage(chatId, '⏩ Registro Presupuestal omitido.');
        if (user) await promptRut(chatId, user);
        return;
    } else if (data === 'skip_doc_rut') {
        await sendTelegramMessage(chatId, '⏩ RUT omitido.');
        if (user) await promptBank(chatId, user);
        return;
    } else if (data === 'skip_doc_bank') {
        await sendTelegramMessage(chatId, '⏩ Certificación Bancaria omitida.');
        if (user) await promptSecuritySocial(chatId, user);
        return;
    } else if (data === 'skip_doc_planilla') {
        await sendTelegramMessage(chatId, '⏩ Planilla de Seguridad Social omitida.');
        if (user) await finishDocsFlow(chatId, user);
        return;
    }

    if (!user) {
        await sendTelegramMessage(chatId, '⚠️ Tu cuenta no está asociada. Envía un saludo (hola) para identificarte o registrarte.');
        return;
    }

    if (data === 'go_back_acts' || data === 'subir_evidencia') {
        await showObligationsFlow(chatId, user, messageId);
    } else if (data === 'show_acts_menu') {
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
        const billingPeriod = await BillingPeriod.findOne({ user: user._id }).sort({ createdAt: -1 });
        if (!billingPeriod) {
            await sendTelegramMessage(chatId, '📭 Aún no tienes periodos registrados en el sistema.');
            return;
        }
        await handleGenerateAndDownload(chatId, user, billingPeriod._id);
        return;
    } else if (data.startsWith('generate_and_download_')) {
        const periodId = data.replace('generate_and_download_', '');
        await handleGenerateAndDownload(chatId, user, periodId);
        return;
    } else if (data.startsWith('send_word_docs_')) {
        const periodId = data.replace('send_word_docs_', '');
        await handleGenerateAndDownload(chatId, user, periodId);
        return;
    } else if (data === 'quick_upload_planilla') {
        const billingPeriod = await BillingPeriod.findOne({ user: user._id }).sort({ createdAt: -1 });
        if (!billingPeriod) {
            await promptSecuritySocial(chatId, user);
        } else {
            await promptPeriodPlanilla(chatId, billingPeriod._id);
        }
        return;
    } else if (data.startsWith('upload_planilla_')) {
        const periodId = data.replace('upload_planilla_', '');
        await promptPeriodPlanilla(chatId, periodId);
        return;
    } else if (data.startsWith('add_more_ev_') || data.startsWith('quick_add_ev_')) {
        const parts = data.split('_');
        const index = parseInt(parts[3], 10);
        const periodId = parts[4];
        const period = await BillingPeriod.findById(periodId);
        const act = period && period.activities ? period.activities[index] : null;
        const oblCode = act ? (act.obligationCode || `2.2.${index + 1}`) : '';
        sessions.set(chatId, {
            state: 'awaiting_file',
            periodId: periodId,
            actNumber: period ? period.actNumber : 1,
            obligationIndex: index,
            comment: (act && act.comment) || 'Actividad desarrollada en el periodo'
        });
        await sendTelegramKeyboardMessage(chatId, `📸 Envía la siguiente foto o archivo de soporte para la Obligación ${oblCode}.\n\n💡 *Tip profesional:* Si deseas que esta imagen tenga un texto descriptivo específico en el Informe de Actividades, puedes incluirlo en el *pie de foto (caption)* al enviarla.`, [
            [{ text: '⬅️ Volver a Obligaciones', callback_data: `select_act_${period ? period.actNumber : 1}` }],
            [{ text: '📊 Resumen del Acta', callback_data: `summary_${periodId}` }]
        ]);
        return;
    }
};
/**
 * Checks if incoming text is an affirmative response
 */
function isAffirmative(str) {
    if (!str) return false;
    const clean = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return /^(si|sí|sisas|sisa|claro|por\s*supuesto|de\s*una|dale|ok|obvio|yes|afirmativo|bueno|seguro|sip|sep|simon|vamos|registrame|registrarme|deseo\s*registrarme|si\s*quiero|si\s*deseo|registrar|adelante|positivo|confirmar)(\s.*|[!.,;:]*)?$/i.test(clean);
}

/**
 * Checks if incoming text is a negative response
 */
function isNegative(str) {
    if (!str) return false;
    const clean = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return /^(no|nop|no\s*gracias|cancelar|para\s*nada|negativo|nunca)(\s.*|[!.,;:]*)?$/i.test(clean);
}

/**
 * Checks if incoming text requests to skip a document
 */
function isSkip(str) {
    if (!str) return false;
    const clean = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return /^(saltar|omitir|no\s*lo\s*tengo|despues|mas\s*tarde|paso|no\s*tengo|siguiente|skip|adelante|omitir\s*documento|saltar\s*documento)$/i.test(clean);
}

/**
 * Checks if incoming text requests to upload or check social security planilla
 */
function isPlanilla(str) {
    if (!str) return false;
    const clean = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return /^((\/)?planilla|seguridad\s*social|pila|(subir|cargar|adjuntar|actualizar)\s*(mi\s*)?(planilla|seguridad\s*social|pila|aportes?))(\s.*)?$/i.test(clean);
}

/**
 * Checks if incoming text requests to upload evidence
 */
function isSubirEvidencia(str) {
    if (!str) return false;
    const clean = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (/^\/(subir|evidencia|evidencias)$/i.test(clean)) return true;
    if (/(subir|cargar|adjuntar|agregar).*(evidencia|soporte|archivo)/i.test(clean)) return true;
    if (/^(subir|cargar|evidencia|evidencias|soportes|soporte)$/i.test(clean)) return true;
    if (/^(si|claro|por\s*supuesto|de\s*una|dale|ok|si\s*por\s*favor)(\s.*)?$/i.test(clean)) return true;
    if (/deseo\s*(cargar|subir)/i.test(clean)) return true;
    return false;
}

/**
 * Checks if incoming text is a greeting or start command
 */
function isGreeting(str) {
    if (!str) return false;
    const clean = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    // If it's "/start" with an explicit verification code argument, let code handler process it
    if (/^\/start\s+\d{4,8}$/i.test(clean)) {
        return false;
    }
    return /^(hola|buen\s*dia|buenos\s*dias|buenas\s*tardes|buenas\s*noches|buenas|saludos|que\s*tal|hi|hello|alo|\/start|start)(\s.*|[!.,;:]*)?$/i.test(clean);
}

/**
 * Processes incoming chat messages from the user
 */
const handleIncomingMessage = async (message) => {
    const chatId = message.chat.id.toString();
    const text = (message.text || '').trim();
    const session = sessions.get(chatId);

    // 1. Cancellation command
    if (text === '/cancelar' || text.toLowerCase() === 'cancelar' || text === '/cancel') {
        sessions.delete(chatId);
        await sendTelegramMessage(chatId, '❌ Operación cancelada. Sesión reiniciada.');
        return;
    }

    // 2. Active interactive states (highest priority: prevent greeting/trigger collision)
    if (session) {
        // Awaiting link cédula (legacy web code association)
        if (session.state === 'awaiting_link_cedula') {
            const inputCedula = text.replace(/\D/g, '');
            if (!inputCedula) {
                await sendTelegramMessage(chatId, '⚠️ Escribe un número de cédula válido (solo dígitos):');
                return;
            }

            const tempUser = session.tempUser;
            const contract = await Contract.findOne({ user: tempUser._id });

            if (!contract) {
                sessions.delete(chatId);
                await sendTelegramMessage(chatId, '⚠️ Falta configurar el contrato en el sistema. Puedes escribir /documentos para comenzar.');
                return;
            }

            const contractCedula = (contract.idNumber || '').replace(/\D/g, '');

            if (inputCedula === contractCedula) {
                tempUser.telegramChatId = chatId;
                tempUser.telegramVerificationCode = null;
                await tempUser.save();

                sessions.delete(chatId);
                await sendTelegramMessage(chatId, `🎉 Hola ${tempUser.fullName}. Tu cuenta ha sido asociada de forma exitosa.\n\nEscribe "subir evidencia" para reportar actividades o /descargar para el paquete ZIP.`);
            } else {
                await sendTelegramMessage(chatId, `❌ La cédula no coincide con los datos del contrato.\n\nEscribe el número correcto o escribe /cancelar para abortar.`);
            }
            return;
        }

        // Awaiting comment for selected obligation
        if (session.state === 'awaiting_comment') {
            if (!text) {
                await sendTelegramMessage(chatId, '⚠️ Por favor, escribe un comentario descriptivo en formato de texto para esta obligación:');
                return;
            }

            const period = await BillingPeriod.findById(session.periodId);
            const act = period ? period.activities[session.obligationIndex] : null;
            const oblCode = act ? (act.obligationCode || `2.2.${session.obligationIndex + 1}`) : '';

            if (['mantener', 'conservar', 'igual', 'dejar igual'].includes(text.toLowerCase().trim())) {
                session.comment = (act && act.comment) ? act.comment : 'Actividad desarrollada en el periodo';
            } else {
                let enrichedComment = text;
                try {
                    await sendTelegramMessage(chatId, '✍️ Redactando descripción técnica profesional con IA...');
                    const user = await User.findOne({ telegramChatId: chatId });
                    const improved = await geminiService.improveEvidenceText({
                        rawText: text,
                        obligationText: act ? act.obligationText : '',
                        contractorName: user ? user.fullName : ''
                    });
                    if (improved && improved.trim().length > 10) {
                        enrichedComment = improved.trim();
                    }
                } catch (err) {
                    console.error('Error enriqueciendo comentario en Telegram:', err.message);
                }
                session.comment = enrichedComment;
            }

            session.state = 'awaiting_file';
            sessions.set(chatId, session);

            let msg = `✨ Descripción profesional redactada para la Obligación ${oblCode}:\n\n"${session.comment}"\n\n`;
            msg += `Ahora, por favor envía el archivo de soporte o evidencia (foto, PDF, Word, Excel o imagen):\n\n(Usa /cancelar para detener)`;

            await sendTelegramKeyboardMessage(chatId, msg, [
                [{ text: 'Cancelar', callback_data: `select_act_${period ? period.actNumber : 1}` }]
            ]);
            return;
        }

        // Awaiting file or additional files for selected obligation
        if (session.state === 'awaiting_file' || session.state === 'awaiting_more_files') {
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
                if (session.state === 'awaiting_more_files') {
                    const lowerText = (text || '').toLowerCase().trim();
                    if (['listo', 'ya', 'terminar', 'termine', 'siguiente', 'continuar', 'fin', 'no mas', 'no más'].includes(lowerText)) {
                        sessions.set(chatId, { state: 'awaiting_obligation_selection', periodId: session.periodId, actNumber: session.actNumber });
                        await selectActFlow(chatId, await User.findOne({ telegramChatId: chatId }), session.actNumber);
                        return;
                    }
                    if (lowerText.includes('resumen')) {
                        sessions.set(chatId, { state: 'awaiting_obligation_selection', periodId: session.periodId, actNumber: session.actNumber });
                        await showPeriodSummary(chatId, session.periodId);
                        return;
                    }
                }
                await sendTelegramMessage(chatId, '⚠️ Por favor adjunta un archivo válido (foto o documento) o toca uno de los botones abajo. Si deseas abortar, escribe /cancelar.');
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Descargando soporte y guardando...');

            try {
                const fileInfo = await downloadFileFromTelegram(fileId, session.obligationIndex, originalName, mimeType);

                const period = await BillingPeriod.findById(session.periodId);
                if (period && period.activities && period.activities[session.obligationIndex]) {
                    const act = period.activities[session.obligationIndex];
                    const caption = (message.caption || '').trim();

                    // Asignar descripción específica si el usuario escribió un pie de foto (caption)
                    fileInfo.description = caption || session.comment || act.comment || '';

                    // Actualizar comentario general de la obligación si no existía o si se redactó uno nuevo
                    if (session.comment && session.comment !== act.comment) {
                        act.comment = session.comment;
                    } else if (!act.comment && caption) {
                        act.comment = caption;
                    }
                    
                    if (!act.evidences) {
                        act.evidences = [];
                    }
                    
                    act.evidences.push(fileInfo);
                    await period.save();

                    const oblCode = act.obligationCode || `2.2.${session.obligationIndex + 1}`;
                    const totalEvs = act.evidences.length;

                    // Mantenemos la sesión para permitir seguir enviando más fotos a esta misma obligación
                    sessions.set(chatId, {
                        state: 'awaiting_more_files',
                        periodId: period._id,
                        actNumber: period.actNumber,
                        obligationIndex: session.obligationIndex,
                        comment: act.comment
                    });

                    let confirmMsg = `🎉 ¡Evidencia guardada con éxito para la Obligación ${oblCode}!\n\n`;
                    confirmMsg += `📎 Total soportes cargados en esta obligación: ${totalEvs}\n`;
                    if (caption) {
                        confirmMsg += `📝 Texto específico asignado a esta imagen: "${caption}"\n\n`;
                    } else {
                        confirmMsg += `📝 Texto descriptivo: "${act.comment}"\n\n`;
                    }
                    confirmMsg += `👉 ¿Deseas subir más fotos o documentos a esta misma obligación? Puedes enviar otra foto directamente (con pie de foto opcional) o seleccionar una opción:`;

                    await sendTelegramKeyboardMessage(chatId, confirmMsg, [
                        [
                            { text: '➕ Enviar otra evidencia a esta obligación', callback_data: `add_more_ev_${session.obligationIndex}_${period._id}` }
                        ],
                        [
                            { text: '📋 Pasar a otra obligación', callback_data: `select_act_${period.actNumber}` },
                            { text: '📊 Resumen del Acta', callback_data: `summary_${period._id}` }
                        ]
                    ]);
                } else {
                    throw new Error('Estructura de periodo no válida.');
                }
            } catch (err) {
                console.error(err);
                await sendTelegramMessage(chatId, `❌ Error al subir la evidencia: ${err.message}. Reintenta o envía /cancelar.`);
            }
            return;
        }

        // Awaiting obligation selection by typing number (e.g. "1", "2", "3", "la 1", "obligación 1")
        if (session.state === 'awaiting_obligation_selection') {
            if (isPlanilla(text)) {
                await promptPeriodPlanilla(chatId, session.periodId);
                return;
            }
            const num = parseInt(text.replace(/\D/g, ''), 10);
            if (!isNaN(num) && num > 0) {
                const period = await BillingPeriod.findById(session.periodId);
                if (period && period.activities && period.activities[num - 1]) {
                    const user = await User.findOne({ telegramChatId: chatId });
                    await selectObligationFlow(chatId, user, period._id, num - 1);
                    return;
                }
            }
            if (text.toLowerCase().includes('resumen')) {
                await showPeriodSummary(chatId, session.periodId);
                return;
            }
            if (text.toLowerCase().includes('acta') || text.toLowerCase().includes('cambiar')) {
                const user = await User.findOne({ telegramChatId: chatId });
                if (user) await showActsMenu(chatId, user);
                return;
            }
        }

        // Awaiting identification cédula
        if (session.state === 'awaiting_identification') {
            const inputCedula = text.replace(/\D/g, '');
            if (!inputCedula || inputCedula.length < 5) {
                await sendTelegramMessage(chatId, '⚠️ Por favor, envíame tu número de documento de identidad en solo dígitos (sin puntos ni letras):');
                return;
            }

            const allContracts = await Contract.find().populate('user');
            const contract = allContracts.find(c => (c.idNumber || '').replace(/\D/g, '') === inputCedula);

            if (contract) {
                let user = contract.user;
                if (!user || !user._id) {
                    user = await User.findById(contract.user) || await User.findOne();
                }
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
                reply += `📋 Contrato: ${contract.contractType || 'Prestación de Servicios'}\n`;
                reply += `🏛️ Dependencia: ${contract.supervisorDependency || 'Alcaldía de Armenia'}\n\n`;
                reply += `Tu usuario ha sido verificado con éxito en la base de datos.\n\n`;

                if (!contract.activities || contract.activities.length === 0) {
                    reply += `⚠️ Aún no has cargado los documentos de tu contrato (Minuta, Acta de Inicio, RP, RUT, Certificación Bancaria).\n\n¿Deseas cargarlos ahora para extraer tus obligaciones y configurar tu cuenta?`;
                    sessions.set(chatId, {
                        state: 'awaiting_docs_consent',
                        userId: user ? user._id : null
                    });
                    await sendTelegramKeyboardMessage(chatId, reply, [
                        [{ text: '📄 Sí, cargar documentos', callback_data: 'start_docs_flow' }],
                        [{ text: '⏰ Más tarde', callback_data: 'skip_docs_flow' }]
                    ]);
                } else {
                    reply += `¿Deseas cargar evidencia para tu informe de actividades?`;

                    await sendTelegramKeyboardMessage(chatId, reply, [
                        [{ text: '📂 Subir Evidencia', callback_data: 'subir_evidencia' }],
                        [{ text: '📄 Actualizar Documentos', callback_data: 'start_docs_flow' }],
                        [{ text: '📦 Descargar Paquete ZIP', callback_data: 'download_zip' }]
                    ]);
                }
            } else {
                sessions.set(chatId, {
                    state: 'awaiting_registration_consent',
                    tempCedula: inputCedula
                });
                let reply = `❌ El documento de identidad "${inputCedula}" no fue encontrado en la base de datos de contratistas.\n\n`;
                reply += `¿Deseas registrarte como nuevo contratista en el sistema?`;

                await sendTelegramKeyboardMessage(chatId, reply, [
                    [
                        { text: '✅ Sí, registrarme', callback_data: 'start_registration' },
                        { text: '❌ No, cancelar', callback_data: 'cancel_registration' }
                    ]
                ]);
            }
            return;
        }

        // -------------------------------------------------------------
        // REGISTRATION FLOW (QUESTIONNAIRE)
        // -------------------------------------------------------------
        // Step 0: Consent to register
        if (session.state === 'awaiting_registration_consent') {
            if (isAffirmative(text)) {
                const cedula = session.tempCedula || '';
                sessions.set(chatId, {
                    state: 'reg_step_name',
                    regData: { cedula }
                });
                await sendTelegramMessage(chatId, `📝 Paso 1 de 5: Nombre Completo\n\nPor favor, escribe tus nombres y apellidos completos:`);
                return;
            } else if (isNegative(text)) {
                sessions.delete(chatId);
                await sendTelegramMessage(chatId, '❌ Registro cancelado. Si deseas iniciar nuevamente en cualquier momento, escribe "hola" o /start.');
                return;
            } else {
                await sendTelegramKeyboardMessage(chatId, `Por favor confirma si deseas registrarte como nuevo contratista en el sistema:`, [
                    [
                        { text: '✅ Sí, registrarme', callback_data: 'start_registration' },
                        { text: '❌ No, cancelar', callback_data: 'cancel_registration' }
                    ]
                ]);
                return;
            }
        }

        // Step 1: Full Name
        if (session.state === 'reg_step_name') {
            if (!text || text.length < 3) {
                await sendTelegramMessage(chatId, '⚠️ Por favor, ingresa un nombre y apellido válido:');
                return;
            }
            session.regData = session.regData || {};
            session.regData.fullName = text.trim();
            session.state = 'reg_step_cedula';
            sessions.set(chatId, session);

            const cedula = session.regData.cedula;
            let msg = `🪪 Paso 2 de 5: Número de Cédula\n\n`;
            if (cedula) {
                msg += `¿Confirmas que tu número de documento es ${cedula}?\n\nPuedes presionar el botón abajo, responder "confirmar" o "si", o escribir el número correcto si deseas cambiarlo:`;
                await sendTelegramKeyboardMessage(chatId, msg, [
                    [{ text: `✅ Confirmar ${cedula}`, callback_data: 'confirm_cedula' }]
                ]);
            } else {
                msg += `Por favor, ingresa tu número de documento de identidad (solo números, sin puntos):`;
                await sendTelegramMessage(chatId, msg);
            }
            return;
        }

        // Step 2: Cédula confirmation or edit
        if (session.state === 'reg_step_cedula') {
            const clean = text.toLowerCase().trim();
            if (clean === 'confirmar' || isAffirmative(clean) || clean === 'mantener') {
                if (!session.regData.cedula) {
                    await sendTelegramMessage(chatId, '⚠️ Por favor escribe tu número de cédula en solo números:');
                    return;
                }
            } else {
                const newCedula = text.replace(/\D/g, '');
                if (!newCedula || newCedula.length < 5) {
                    await sendTelegramMessage(chatId, '⚠️ Por favor escribe un número de documento válido (mínimo 5 dígitos):');
                    return;
                }
                session.regData.cedula = newCedula;
            }

            // Check if already registered
            const existingContract = await Contract.findOne({ idNumber: session.regData.cedula });
            if (existingContract) {
                await sendTelegramMessage(chatId, `⚠️ El documento ${session.regData.cedula} ya se encuentra registrado en el sistema para "${existingContract.contractorName}".\n\nEscribe "hola" para identificarte.`);
                sessions.delete(chatId);
                return;
            }

            session.state = 'reg_step_entity';
            sessions.set(chatId, session);

            await sendTelegramMessage(chatId, `🏛️ Paso 3 de 5: Entidad o Dependencia\n\n¿A qué secretaría, dependencia o entidad perteneces?\n(Ejemplo: Secretaría TIC, Secretaría de Hacienda, Secretaría de Educación, Alcaldía de Armenia):`);
            return;
        }

        // Step 3: Entity / Dependency
        if (session.state === 'reg_step_entity') {
            if (!text || text.length < 3) {
                await sendTelegramMessage(chatId, '⚠️ Por favor ingresa el nombre de la secretaría o entidad a la que perteneces:');
                return;
            }
            session.regData.entity = text.trim();
            session.state = 'reg_step_phone';
            sessions.set(chatId, session);

            await sendTelegramMessage(chatId, `📱 Paso 4 de 5: Número de Contacto\n\nPor favor, escribe tu número de teléfono o celular de contacto:`);
            return;
        }

        // Step 4: Contact Phone
        if (session.state === 'reg_step_phone') {
            const phoneDigits = text.replace(/\D/g, '');
            if (!phoneDigits || phoneDigits.length < 7) {
                await sendTelegramMessage(chatId, '⚠️ Por favor ingresa un número telefónico o celular válido (mínimo 7 dígitos):');
                return;
            }
            session.regData.phone = text.trim();
            session.state = 'reg_step_email';
            sessions.set(chatId, session);

            await sendTelegramMessage(chatId, `📧 Paso 5 de 5: Correo Electrónico\n\nPor favor, escribe tu dirección de correo electrónico:`);
            return;
        }

        // Step 5: Email Address & Completion
        if (session.state === 'reg_step_email') {
            const email = text.trim().toLowerCase();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                await sendTelegramMessage(chatId, '⚠️ El formato del correo no es válido. Por favor escribe un correo válido (ej: nombre@dominio.com):');
                return;
            }

            const existingUser = await User.findOne({ email: email });
            if (existingUser) {
                await sendTelegramMessage(chatId, `⚠️ El correo "${email}" ya está registrado por otro usuario.\n\nPor favor ingresa una dirección de correo electrónico diferente:`);
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Creando tu cuenta y vinculando tus datos en el sistema...');

            try {
                const regData = session.regData;
                const defaultPassword = `Contratista.${regData.cedula}*`;

                // 1. Create User
                const newUser = await User.create({
                    fullName: regData.fullName,
                    email: email,
                    password: defaultPassword,
                    role: 'client',
                    telegramChatId: chatId
                });

                // 2. Create Contract record linked to User
                const newContract = await Contract.create({
                    user: newUser._id,
                    contractorName: regData.fullName,
                    idNumber: regData.cedula,
                    supervisorDependency: regData.entity,
                    contractorPhone: regData.phone,
                    contractorEmail: email,
                    activities: [],
                    startDate: new Date().toISOString().split('T')[0]
                });

                sessions.set(chatId, {
                    state: 'awaiting_docs_consent',
                    userId: newUser._id
                });

                let confirmMsg = `🎉 ¡Registro completado con éxito!\n\n`;
                confirmMsg += `👤 Contratista: ${regData.fullName}\n`;
                confirmMsg += `🪪 Cédula: ${regData.cedula}\n`;
                confirmMsg += `🏛️ Dependencia: ${regData.entity}\n`;
                confirmMsg += `📱 Teléfono: ${regData.phone}\n`;
                confirmMsg += `📧 Correo: ${email}\n\n`;
                confirmMsg += `Tu usuario ha quedado registrado y vinculado a este chat de Telegram.\n\n`;
                confirmMsg += `🔑 Acceso web:\n`;
                confirmMsg += `• Usuario: ${email}\n`;
                confirmMsg += `• Clave provisional: ${defaultPassword}\n\n`;
                confirmMsg += `📋 Para que el sistema pueda generar tus cuentas de cobro y extraer tus obligaciones contractuales, vamos a cargar tus 6 documentos (Minuta, Acta de Inicio, RP, RUT, Certificación Bancaria y Planilla de Seguridad Social).\n\n`;
                confirmMsg += `¿Deseas cargarlos ahora uno por uno?`;

                await sendTelegramKeyboardMessage(chatId, confirmMsg, [
                    [{ text: '📄 Sí, cargar documentos', callback_data: 'start_docs_flow' }],
                    [{ text: '⏰ Más tarde', callback_data: 'skip_docs_flow' }]
                ]);
            } catch (err) {
                console.error('Error al registrar usuario desde Telegram:', err);
                await sendTelegramMessage(chatId, `❌ Ocurrió un error al registrar tus datos: ${err.message}. Por favor intenta nuevamente o escribe /cancelar.`);
            }
            return;
        }

        // -------------------------------------------------------------
        // SEQUENTIAL CONTRACT DOCUMENTS FLOW (6 STEPS)
        // -------------------------------------------------------------
        // Step 0: Consent to start loading docs
        if (session.state === 'awaiting_docs_consent') {
            const user = (session.userId ? await User.findById(session.userId) : null) || await User.findOne({ telegramChatId: chatId });
            if (isAffirmative(text)) {
                if (user) await startContractDocsFlow(chatId, user);
                return;
            } else if (isNegative(text) || isSkip(text)) {
                sessions.set(chatId, { state: 'idle' });
                await sendTelegramMessage(chatId, '👍 Entendido. Puedes iniciar la carga de los documentos de tu contrato en cualquier momento escribiendo "documentos" o "hola".');
                return;
            } else {
                await sendTelegramKeyboardMessage(chatId, '¿Deseas iniciar la carga de los 6 documentos de tu contrato ahora?', [
                    [{ text: '📄 Sí, cargar documentos', callback_data: 'start_docs_flow' }],
                    [{ text: '⏰ Más tarde', callback_data: 'skip_docs_flow' }]
                ]);
                return;
            }
        }

        // Doc Step 1: Minuta del Contrato (PDF)
        if (session.state === 'awaiting_doc_minuta') {
            const user = (session.userId ? await User.findById(session.userId) : null) || await User.findOne({ telegramChatId: chatId });
            if (!user) {
                sessions.delete(chatId);
                await sendTelegramMessage(chatId, '⚠️ Sesión no válida. Escribe "hola" para identificarte.');
                return;
            }

            if (isSkip(text)) {
                await sendTelegramMessage(chatId, '⏩ Minuta omitida.');
                await promptActaInicio(chatId, user);
                return;
            }

            const media = extractTelegramFile(message);
            if (!media) {
                await sendTelegramKeyboardMessage(chatId, '⚠️ Por favor adjunta el archivo PDF de la minuta de tu contrato, o escribe "saltar" para continuar sin este documento:', [
                    [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_minuta' }]
                ]);
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Descargando minuta y analizando con Inteligencia Artificial...');
            try {
                const fileInfo = await downloadTelegramMedia(media.fileId, 'minuta', media.originalName, media.mimeType);
                let contract = await Contract.findOne({ user: user._id });
                if (!contract) contract = new Contract({ user: user._id });
                contract.baseDocumentPath = fileInfo.relativePath;

                try {
                    const extracted = await geminiService.extractContractData(fileInfo.absolutePath);
                    if (extracted) {
                        if (extracted.contractNumber) contract.contractNumber = extracted.contractNumber;
                        if (extracted.contractType) contract.contractType = extracted.contractType;
                        if (extracted.contractorName && !contract.contractorName) contract.contractorName = extracted.contractorName;
                        if (extracted.idNumber && !contract.idNumber) contract.idNumber = extracted.idNumber;
                        if (extracted.startDate) contract.startDate = extracted.startDate;
                        if (extracted.endDate) contract.endDate = extracted.endDate;
                        if (extracted.executionTerm) contract.executionTerm = extracted.executionTerm;
                        if (extracted.periodType) contract.periodType = extracted.periodType;
                        if (extracted.initialDurationMonths) contract.initialDurationMonths = Number(extracted.initialDurationMonths);
                        if (extracted.cdp) contract.cdp = extracted.cdp;
                        if (extracted.rp) contract.rp = extracted.rp;
                        if (extracted.rubro) contract.rubro = extracted.rubro;
                        if (extracted.totalValue) contract.totalValue = String(extracted.totalValue);
                        if (extracted.totalValueWord) contract.totalValueWord = extracted.totalValueWord;
                        if (extracted.monthlyValue) contract.monthlyValue = String(extracted.monthlyValue);
                        if (extracted.monthlyValueWord) contract.monthlyValueWord = extracted.monthlyValueWord;
                        if (extracted.bankName) contract.bankName = extracted.bankName;
                        if (extracted.accountNumber) contract.accountNumber = extracted.accountNumber;
                        if (extracted.paymentMethod) contract.paymentMethod = extracted.paymentMethod;
                        if (extracted.contractObject) contract.contractObject = extracted.contractObject;
                        if (extracted.supervisorName) contract.supervisorName = extracted.supervisorName;
                        if (extracted.supervisorDependency) contract.supervisorDependency = extracted.supervisorDependency;
                        if (extracted.contractorAddress) contract.contractorAddress = extracted.contractorAddress;
                        if (extracted.contractorPhone) contract.contractorPhone = extracted.contractorPhone;
                        if (extracted.cutoffDay) contract.cutoffDay = Number(extracted.cutoffDay);
                        if (extracted.activities && Array.isArray(extracted.activities) && extracted.activities.length > 0) {
                            contract.activities = extracted.activities;
                        }
                    }
                    await contract.save();
                    const oblCount = contract.activities ? contract.activities.length : 0;
                    await sendTelegramMessage(chatId, `✅ Minuta procesada con éxito.\n📋 Contrato N°: ${contract.contractNumber || 'Registrado'}\n📝 Obligaciones identificadas: ${oblCount}`);
                } catch (aiErr) {
                    console.error('Error de IA en Minuta:', aiErr);
                    await contract.save();
                    await sendTelegramMessage(chatId, `⚠️ Se guardó el archivo de la Minuta, pero no se pudo extraer toda la información automáticamente (${aiErr.message}).`);
                }
            } catch (err) {
                console.error('Error al descargar Minuta:', err);
                await sendTelegramMessage(chatId, `❌ Error al procesar el archivo: ${err.message}`);
            }
            await promptActaInicio(chatId, user);
            return;
        }

        // Doc Step 2: Acta de Inicio (PDF)
        if (session.state === 'awaiting_doc_acta_inicio') {
            const user = (session.userId ? await User.findById(session.userId) : null) || await User.findOne({ telegramChatId: chatId });
            if (!user) {
                sessions.delete(chatId);
                await sendTelegramMessage(chatId, '⚠️ Sesión no válida. Escribe "hola" para identificarte.');
                return;
            }

            if (isSkip(text)) {
                await sendTelegramMessage(chatId, '⏩ Acta de Inicio omitida.');
                await promptRp(chatId, user);
                return;
            }

            const media = extractTelegramFile(message);
            if (!media) {
                await sendTelegramKeyboardMessage(chatId, '⚠️ Por favor adjunta el archivo PDF del Acta de Inicio, o presiona saltar para continuar:', [
                    [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_acta' }]
                ]);
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Descargando Acta de Inicio y analizando con IA...');
            try {
                const fileInfo = await downloadTelegramMedia(media.fileId, 'acta_inicio', media.originalName, media.mimeType);
                let contract = await Contract.findOne({ user: user._id });
                if (contract) {
                    contract.actaInicioPath = fileInfo.relativePath;
                    try {
                        const extracted = await geminiService.extractActaInicioData(fileInfo.absolutePath);
                        if (extracted) {
                            if (extracted.startDate) contract.startDate = extracted.startDate;
                            if (extracted.endDate) contract.endDate = extracted.endDate;
                            if (extracted.executionTerm && !contract.executionTerm) contract.executionTerm = extracted.executionTerm;
                            if (extracted.contractNumber && !contract.contractNumber) contract.contractNumber = extracted.contractNumber;
                            if (extracted.supervisorName && !contract.supervisorName) contract.supervisorName = extracted.supervisorName;
                            if (extracted.initialDurationMonths) contract.initialDurationMonths = Number(extracted.initialDurationMonths);
                        }
                        await contract.save();
                        const durText = getContractDurationText(contract);
                        let actaMsg = `✅ Acta de Inicio procesada con éxito.\n📅 Fecha de inicio: ${contract.startDate ? contract.startDate.split('T')[0] : 'N/A'}`;
                        if (contract.endDate) {
                            actaMsg += `\n📅 Fecha fin: ${contract.endDate.split('T')[0]}`;
                        }
                        actaMsg += `\n⏱️ Plazo / Duración: ${durText}`;
                        await sendTelegramMessage(chatId, actaMsg);
                    } catch (aiErr) {
                        console.error('Error de IA en Acta de Inicio:', aiErr);
                        await contract.save();
                        await sendTelegramMessage(chatId, `⚠️ Se guardó el Acta de Inicio (${aiErr.message}).`);
                    }
                }
            } catch (err) {
                console.error('Error al descargar Acta de Inicio:', err);
                await sendTelegramMessage(chatId, `❌ Error al procesar archivo: ${err.message}`);
            }
            await promptRp(chatId, user);
            return;
        }

        // Doc Step 3: Registro Presupuestal (RP)
        if (session.state === 'awaiting_doc_rp') {
            const user = (session.userId ? await User.findById(session.userId) : null) || await User.findOne({ telegramChatId: chatId });
            if (!user) {
                sessions.delete(chatId);
                await sendTelegramMessage(chatId, '⚠️ Sesión no válida. Escribe "hola" para identificarte.');
                return;
            }

            if (isSkip(text)) {
                await sendTelegramMessage(chatId, '⏩ Registro Presupuestal omitido.');
                await promptRut(chatId, user);
                return;
            }

            const media = extractTelegramFile(message);
            if (!media) {
                await sendTelegramKeyboardMessage(chatId, '⚠️ Por favor adjunta el archivo PDF del RP (Registro Presupuestal), o presiona saltar para continuar:', [
                    [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_rp' }]
                ]);
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Descargando RP y analizando con IA...');
            try {
                const fileInfo = await downloadTelegramMedia(media.fileId, 'rp', media.originalName, media.mimeType);
                let contract = await Contract.findOne({ user: user._id });
                if (contract) {
                    contract.rpPath = fileInfo.relativePath;
                    try {
                        const extracted = await geminiService.extractRpData(fileInfo.absolutePath);
                        if (extracted) {
                            if (extracted.rpNumber) contract.rp = extracted.rpNumber;
                            if (extracted.cdpNumber) contract.cdp = extracted.cdpNumber;
                            if (extracted.rubro) contract.rubro = extracted.rubro;
                        }
                        await contract.save();
                        await sendTelegramMessage(chatId, `✅ Registro Presupuestal procesado con éxito.\n📋 RP N°: ${contract.rp || 'N/A'} | CDP: ${contract.cdp || 'N/A'}\n🏷️ Rubro: ${contract.rubro || 'N/A'}`);
                    } catch (aiErr) {
                        console.error('Error de IA en RP:', aiErr);
                        await contract.save();
                        await sendTelegramMessage(chatId, `⚠️ Se guardó el RP (${aiErr.message}).`);
                    }
                }
            } catch (err) {
                console.error('Error al procesar RP:', err);
                await sendTelegramMessage(chatId, `❌ Error al procesar archivo: ${err.message}`);
            }
            await promptRut(chatId, user);
            return;
        }

        // Doc Step 4: RUT
        if (session.state === 'awaiting_doc_rut') {
            const user = (session.userId ? await User.findById(session.userId) : null) || await User.findOne({ telegramChatId: chatId });
            if (!user) {
                sessions.delete(chatId);
                await sendTelegramMessage(chatId, '⚠️ Sesión no válida. Escribe "hola" para identificarte.');
                return;
            }

            if (isSkip(text)) {
                await sendTelegramMessage(chatId, '⏩ RUT omitido.');
                await promptBank(chatId, user);
                return;
            }

            const media = extractTelegramFile(message);
            if (!media) {
                await sendTelegramKeyboardMessage(chatId, '⚠️ Por favor adjunta el PDF de tu RUT, o presiona saltar para continuar:', [
                    [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_rut' }]
                ]);
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Descargando RUT y analizando con IA...');
            try {
                const fileInfo = await downloadTelegramMedia(media.fileId, 'rut', media.originalName, media.mimeType);
                let contract = await Contract.findOne({ user: user._id });
                if (contract) {
                    contract.rutPath = fileInfo.relativePath;
                    const candidates = [];
                    if (contract.idNumber) {
                        candidates.push(contract.idNumber.trim());
                        const clean = contract.idNumber.replace(/\D/g, '');
                        if (clean && clean !== contract.idNumber.trim()) candidates.push(clean);
                    }

                    try {
                        const extracted = await geminiService.extractRutData(fileInfo.absolutePath, {
                            candidatePasswords: candidates
                        });
                        if (extracted) {
                            if (extracted.contractorAddress) contract.contractorAddress = extracted.contractorAddress;
                            if (extracted.idCity) contract.idCity = extracted.idCity;
                            if (typeof extracted.isTaxFiler === 'boolean') contract.isTaxFiler = extracted.isTaxFiler;
                            if (extracted.contractorPhone && !contract.contractorPhone) contract.contractorPhone = extracted.contractorPhone;
                            if (extracted.contractorEmail && !contract.contractorEmail) contract.contractorEmail = extracted.contractorEmail;
                        }
                        await contract.save();
                        const note = extracted?.unlockedWithCedula ? ' (desbloqueado automáticamente con tu cédula)' : '';
                        await sendTelegramMessage(chatId, `✅ RUT procesado con éxito${note}.\n📍 Dirección: ${contract.contractorAddress || 'N/A'} (${contract.idCity || ''})\n💼 Declarante de Renta: ${contract.isTaxFiler ? 'Sí' : 'No'}`);
                    } catch (aiErr) {
                        console.error('Error de IA en RUT:', aiErr);
                        await contract.save();
                        if (aiErr.code === 'PASSWORD_REQUIRED') {
                            await sendTelegramMessage(chatId, `🔐 *RUT Protegido con Contraseña*\n\nTu RUT está protegido con clave e intentamos acceder con tu cédula (*${contract.idNumber || 'No registrada'}*), pero no coincidió.\n\nPor favor envía un PDF sin clave o desbloqueado.`);
                        } else {
                            await sendTelegramMessage(chatId, `⚠️ Se guardó el RUT (${aiErr.message}).`);
                        }
                    }
                }
            } catch (err) {
                console.error('Error al procesar RUT:', err);
                await sendTelegramMessage(chatId, `❌ Error al procesar archivo: ${err.message}`);
            }
            await promptBank(chatId, user);
            return;
        }

        // Doc Step 5: Certificación Bancaria
        if (session.state === 'awaiting_doc_bank') {
            const user = (session.userId ? await User.findById(session.userId) : null) || await User.findOne({ telegramChatId: chatId });
            if (!user) {
                sessions.delete(chatId);
                await sendTelegramMessage(chatId, '⚠️ Sesión no válida. Escribe "hola" para identificarte.');
                return;
            }

            if (isSkip(text)) {
                await sendTelegramMessage(chatId, '⏩ Certificación Bancaria omitida.');
                await promptSecuritySocial(chatId, user);
                return;
            }

            const media = extractTelegramFile(message);
            if (!media) {
                await sendTelegramKeyboardMessage(chatId, '⚠️ Por favor adjunta la certificación bancaria (PDF o imagen), o presiona saltar para continuar:', [
                    [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_bank' }]
                ]);
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Descargando Certificación Bancaria y analizando con IA...');
            try {
                const fileInfo = await downloadTelegramMedia(media.fileId, 'bank_cert', media.originalName, media.mimeType);
                let contract = await Contract.findOne({ user: user._id });
                if (contract) {
                    contract.bankCertificatePath = fileInfo.relativePath;
                    const candidates = [];
                    if (contract.idNumber) {
                        candidates.push(contract.idNumber.trim());
                        const clean = contract.idNumber.replace(/\D/g, '');
                        if (clean && clean !== contract.idNumber.trim()) candidates.push(clean);
                    }

                    try {
                        const extracted = await geminiService.extractBankCertificateData(fileInfo.absolutePath, {
                            candidatePasswords: candidates
                        });
                        if (extracted) {
                            if (extracted.bankName) contract.bankName = extracted.bankName;
                            if (extracted.accountNumber) contract.accountNumber = extracted.accountNumber;
                            if (extracted.paymentMethod) contract.paymentMethod = extracted.paymentMethod;
                        }
                        await contract.save();
                        const note = extracted?.unlockedWithCedula ? ' (desbloqueada automáticamente con tu cédula)' : '';
                        await sendTelegramMessage(chatId, `✅ Certificación Bancaria procesada con éxito${note}.\n🏦 Banco: ${contract.bankName || 'N/A'}\n💳 Cuenta: ${contract.paymentMethod || 'Ahorros'} N° ${contract.accountNumber || 'N/A'}`);
                    } catch (aiErr) {
                        console.error('Error de IA en Certificación Bancaria:', aiErr);
                        await contract.save();
                        if (aiErr.code === 'PASSWORD_REQUIRED') {
                            await sendTelegramMessage(chatId, `🔐 *Certificado Bancario Protegido con Contraseña*\n\nTu certificación bancaria está protegida con clave e intentamos acceder con tu cédula (*${contract.idNumber || 'No registrada'}*), pero no coincidió.\n\nPor favor envía un PDF sin clave o desbloqueado.`);
                        } else {
                            await sendTelegramMessage(chatId, `⚠️ Se guardó la Certificación Bancaria (${aiErr.message}).`);
                        }
                    }
                }
            } catch (err) {
                console.error('Error al procesar Certificación Bancaria:', err);
                await sendTelegramMessage(chatId, `❌ Error al procesar archivo: ${err.message}`);
            }
            await promptSecuritySocial(chatId, user);
            return;
        }

        // Doc Step 6: Planilla de Seguridad Social
        if (session.state === 'awaiting_doc_planilla') {
            const user = (session.userId ? await User.findById(session.userId) : null) || await User.findOne({ telegramChatId: chatId });
            if (!user) {
                sessions.delete(chatId);
                await sendTelegramMessage(chatId, '⚠️ Sesión no válida. Escribe "hola" para identificarte.');
                return;
            }

            if (isSkip(text)) {
                await sendTelegramMessage(chatId, '⏩ Planilla de Seguridad Social omitida.');
                await finishDocsFlow(chatId, user);
                return;
            }

            const media = extractTelegramFile(message);
            if (!media) {
                await sendTelegramKeyboardMessage(chatId, '⚠️ Por favor adjunta el archivo PDF o foto de tu planilla de seguridad social (PILA), o presiona saltar para finalizar:', [
                    [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_planilla' }]
                ]);
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Descargando Planilla de Seguridad Social y analizando con Inteligencia Artificial...');
            try {
                const fileInfo = await downloadTelegramMedia(media.fileId, 'seguridad_social', media.originalName, media.mimeType);
                let contract = await Contract.findOne({ user: user._id });
                if (contract) {
                    contract.securitySocialPath = fileInfo.relativePath;
                    await contract.save();
                }

                // Also update the latest / pending billing period if exists
                const billingPeriod = await BillingPeriod.findOne({ user: user._id }).sort({ createdAt: -1 });

                try {
                    const extracted = await geminiService.extractSecuritySocialData(fileInfo.absolutePath);
                    if (extracted) {
                        if (billingPeriod) {
                            billingPeriod.securitySocialPath = fileInfo.relativePath;
                            billingPeriod.securitySocial = {
                                operator: extracted.operator || '',
                                planillaNumber: extracted.planillaNumber ? String(extracted.planillaNumber) : '',
                                totalPaid: Number(extracted.totalPaid) || 0,
                                saludPaid: Number(extracted.saludPaid) || 0,
                                pensionPaid: Number(extracted.pensionPaid) || 0,
                                arlPaid: Number(extracted.arlPaid) || 0,
                                period: extracted.period || ''
                            };
                            await billingPeriod.save();
                        }

                        let ssMsg = `✅ Planilla de Seguridad Social procesada con éxito.\n`;
                        if (extracted.operator) ssMsg += `🏢 Operador: ${extracted.operator}\n`;
                        if (extracted.planillaNumber) ssMsg += `🔢 N° Planilla: ${extracted.planillaNumber}\n`;
                        if (extracted.period) ssMsg += `📅 Periodo: ${extracted.period}\n`;
                        if (extracted.totalPaid) {
                            ssMsg += `💰 Total Pagado: $${Number(extracted.totalPaid).toLocaleString('es-CO')}\n`;
                            if (extracted.saludPaid) ssMsg += `  • Salud: $${Number(extracted.saludPaid).toLocaleString('es-CO')}\n`;
                            if (extracted.pensionPaid) ssMsg += `  • Pensión: $${Number(extracted.pensionPaid).toLocaleString('es-CO')}\n`;
                            if (extracted.arlPaid) ssMsg += `  • ARL: $${Number(extracted.arlPaid).toLocaleString('es-CO')}\n`;
                        }
                        await sendTelegramMessage(chatId, ssMsg);
                    }
                } catch (aiErr) {
                    console.error('Error de IA en Planilla SS:', aiErr);
                    if (billingPeriod) {
                        billingPeriod.securitySocialPath = fileInfo.relativePath;
                        await billingPeriod.save();
                    }
                    await sendTelegramMessage(chatId, `⚠️ Se guardó el archivo de la Planilla, pero no se pudieron extraer todos los datos automáticamente (${aiErr.message}).`);
                }
            } catch (err) {
                console.error('Error al procesar Planilla SS:', err);
                await sendTelegramMessage(chatId, `❌ Error al procesar archivo: ${err.message}`);
            }
            await finishDocsFlow(chatId, user);
            return;
        }

        // Upload Planilla for a specific BillingPeriod (Acta)
        if (session.state === 'awaiting_period_planilla') {
            const user = (session.userId ? await User.findById(session.userId) : null) || await User.findOne({ telegramChatId: chatId });
            if (!user) {
                sessions.delete(chatId);
                await sendTelegramMessage(chatId, '⚠️ Sesión no válida. Escribe "hola" para identificarte.');
                return;
            }

            if (isNegative(text) || text.toLowerCase() === 'cancelar') {
                const periodId = session.periodId;
                sessions.set(chatId, { state: 'idle' });
                await sendTelegramMessage(chatId, '❌ Carga de planilla cancelada.');
                if (periodId) await showPeriodSummary(chatId, periodId);
                return;
            }

            const media = extractTelegramFile(message);
            if (!media) {
                await sendTelegramKeyboardMessage(chatId, '⚠️ Por favor adjunta el archivo PDF o foto de tu planilla de seguridad social, o presiona Cancelar:', [
                    [{ text: '❌ Cancelar', callback_data: `summary_${session.periodId}` }]
                ]);
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Descargando planilla y analizando con Inteligencia Artificial...');
            try {
                const fileInfo = await downloadTelegramMedia(media.fileId, 'seguridad_social', media.originalName, media.mimeType);
                const period = await BillingPeriod.findById(session.periodId);
                if (!period) {
                    await sendTelegramMessage(chatId, '⚠️ No se encontró el periodo del acta.');
                    return;
                }

                period.securitySocialPath = fileInfo.relativePath;

                // Also update contract securitySocialPath
                await Contract.findOneAndUpdate({ user: user._id }, { securitySocialPath: fileInfo.relativePath });

                try {
                    const extracted = await geminiService.extractSecuritySocialData(fileInfo.absolutePath);
                    if (extracted) {
                        period.securitySocial = {
                            operator: extracted.operator || '',
                            planillaNumber: extracted.planillaNumber ? String(extracted.planillaNumber) : '',
                            totalPaid: Number(extracted.totalPaid) || 0,
                            saludPaid: Number(extracted.saludPaid) || 0,
                            pensionPaid: Number(extracted.pensionPaid) || 0,
                            arlPaid: Number(extracted.arlPaid) || 0,
                            period: extracted.period || ''
                        };
                        await period.save();

                        let ssMsg = `✅ ¡Planilla de Seguridad Social guardada y vinculada al Acta N° ${period.actNumber}!\n\n`;
                        if (extracted.operator) ssMsg += `🏢 Operador: ${extracted.operator}\n`;
                        if (extracted.planillaNumber) ssMsg += `🔢 N° Planilla: ${extracted.planillaNumber}\n`;
                        if (extracted.period) ssMsg += `📅 Periodo: ${extracted.period}\n`;
                        if (extracted.totalPaid) {
                            ssMsg += `💰 Total Pagado: $${Number(extracted.totalPaid).toLocaleString('es-CO')}\n`;
                            if (extracted.saludPaid) ssMsg += `  • Salud: $${Number(extracted.saludPaid).toLocaleString('es-CO')}\n`;
                            if (extracted.pensionPaid) ssMsg += `  • Pensión: $${Number(extracted.pensionPaid).toLocaleString('es-CO')}\n`;
                            if (extracted.arlPaid) ssMsg += `  • ARL: $${Number(extracted.arlPaid).toLocaleString('es-CO')}\n`;
                        }
                        await sendTelegramMessage(chatId, ssMsg);
                    }
                } catch (aiErr) {
                    console.error('Error IA planilla periodo:', aiErr);
                    await period.save();
                    await sendTelegramMessage(chatId, `⚠️ Se guardó el archivo de la Planilla en el Acta N° ${period.actNumber}, pero no se pudieron extraer todos los datos automáticamente (${aiErr.message}).`);
                }

                sessions.set(chatId, { state: 'idle' });
                await showPeriodSummary(chatId, period._id);
                return;
            } catch (err) {
                console.error('Error al procesar planilla de periodo:', err);
                await sendTelegramMessage(chatId, `❌ Error al procesar archivo: ${err.message}`);
                return;
            }
        }
    }

    // 3. Greeting Detection: "hola", "buen dia", "/start", etc.
    if (isGreeting(text)) {
        sessions.set(chatId, { state: 'awaiting_identification' });
        await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
        return;
    }

    // 4. Planilla trigger: "planilla", "subir planilla", "seguridad social", etc.
    if (isPlanilla(text)) {
        const user = await User.findOne({ telegramChatId: chatId });
        if (!user) {
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }

        const billingPeriod = await BillingPeriod.findOne({ user: user._id }).sort({ createdAt: -1 });
        if (!billingPeriod) {
            await promptSecuritySocial(chatId, user);
            return;
        }

        await promptPeriodPlanilla(chatId, billingPeriod._id);
        return;
    }

    // 5. "Subir Evidencia" trigger: "subir evidencia", "si", "si deseo cargar evidencia", etc.
    if (isSubirEvidencia(text)) {
        const user = await User.findOne({ telegramChatId: chatId });
        if (!user) {
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }
        await showObligationsFlow(chatId, user);
        return;
    }

    // 6. Direct Cédula Detection (if user directly types their ID number without greeting first)
    const numericOnly = text.replace(/\D/g, '');
    const isOnlyDigitsAndDots = /^[\d.\s]+$/.test(text);
    if (isOnlyDigitsAndDots && numericOnly.length >= 6 && numericOnly.length <= 11) {
        const allContracts = await Contract.find().populate('user');
        const contract = allContracts.find(c => (c.idNumber || '').replace(/\D/g, '') === numericOnly);

        if (contract) {
            let user = contract.user;
            if (!user || !user._id) {
                user = await User.findById(contract.user) || await User.findOne();
            }
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
            reply += `📋 Contrato: ${contract.contractType || 'Prestación de Servicios'}\n`;
            reply += `🏛️ Dependencia: ${contract.supervisorDependency || 'Alcaldía de Armenia'}\n\n`;
            reply += `Tu usuario ha sido verificado con éxito en la base de datos.\n\n`;

            if (!contract.activities || contract.activities.length === 0) {
                reply += `⚠️ Aún no has cargado los documentos de tu contrato (Minuta, Acta de Inicio, RP, RUT, Certificación Bancaria, Planilla de Seguridad Social).\n\n¿Deseas cargarlos ahora para extraer tus obligaciones y configurar tu cuenta?`;
                sessions.set(chatId, {
                    state: 'awaiting_docs_consent',
                    userId: user ? user._id : null
                });
                await sendTelegramKeyboardMessage(chatId, reply, [
                    [{ text: '📄 Sí, cargar documentos', callback_data: 'start_docs_flow' }],
                    [{ text: '⏰ Más tarde', callback_data: 'skip_docs_flow' }]
                ]);
            } else {
                reply += `¿Qué deseas realizar hoy?`;

                await sendTelegramKeyboardMessage(chatId, reply, [
                    [{ text: '📂 Subir Evidencia', callback_data: 'subir_evidencia' }],
                    [{ text: '🏥 Subir Planilla SS', callback_data: 'quick_upload_planilla' }],
                    [{ text: '📄 Actualizar Documentos', callback_data: 'start_docs_flow' }],
                    [{ text: '📦 Descargar Paquete ZIP', callback_data: 'download_zip' }]
                ]);
            }
            return;
        } else {
            sessions.set(chatId, {
                state: 'awaiting_registration_consent',
                tempCedula: numericOnly
            });
            let reply = `❌ El documento de identidad "${numericOnly}" no fue encontrado en la base de datos de contratistas.\n\n`;
            reply += `¿Deseas registrarte como nuevo contratista en el sistema?`;

            await sendTelegramKeyboardMessage(chatId, reply, [
                [
                    { text: '✅ Sí, registrarme', callback_data: 'start_registration' },
                    { text: '❌ No, cancelar', callback_data: 'cancel_registration' }
                ]
            ]);
            return;
        }
    }

    // 7. Explicit commands
    if (text.startsWith('/start')) {
        const parts = text.split(' ');
        if (parts.length > 1 && parts[1].trim()) {
            const code = parts[1].trim();
            const user = await User.findOne({ telegramVerificationCode: code });
            if (user) {
                user.telegramChatId = chatId;
                user.telegramVerificationCode = null;
                await user.save();

                const contract = await Contract.findOne({ user: user._id });

                sessions.set(chatId, {
                    state: 'identified',
                    userId: user._id,
                    contractId: contract ? contract._id : null,
                    cedula: contract?.idNumber || ''
                });

                let reply = `✅ ¡Cuenta vinculada exitosamente!\n\n`;
                reply += `👋 Hola ${user.fullName}, tu cuenta de Telegram ha quedado conectada con éxito a tu usuario en el sistema.\n\n`;

                if (!contract) {
                    reply += `ℹ️ Nota: Aún no has configurado tu contrato base en el sistema.\n`;
                    reply += `Puedes escribir /documentos para subir tu minuta y documentos ahora mismo para comenzar a radicar cuentas de cobro.`;
                    await sendTelegramMessage(chatId, reply);
                } else if (!contract.activities || contract.activities.length === 0) {
                    reply += `⚠️ Tu contrato está registrado pero aún no tiene obligaciones específicas cargadas.\n\nPuedes cargar tu minuta en PDF para extraerlas.`;
                    await sendTelegramMessage(chatId, reply);
                } else {
                    reply += `¿Qué deseas realizar hoy?`;
                    await sendTelegramKeyboardMessage(chatId, reply, [
                        [{ text: '📂 Subir Evidencia', callback_data: 'subir_evidencia' }],
                        [{ text: '🏥 Subir Planilla SS', callback_data: 'quick_upload_planilla' }],
                        [{ text: '📄 Actualizar Documentos', callback_data: 'start_docs_flow' }],
                        [{ text: '📦 Descargar Paquete ZIP', callback_data: 'download_zip' }]
                    ]);
                }
            } else {
                await sendTelegramMessage(chatId, `❌ El código "${code}" es inválido o ya expiró. Puedes escribir tu número de cédula para identificarte directamente.`);
            }
        } else {
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
        }
    } else if (text === '/subir' || text.toLowerCase() === 'subir') {
        const user = await User.findOne({ telegramChatId: chatId });
        if (!user) {
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }
        await showObligationsFlow(chatId, user);
    } else if (
        text === '/descargar' ||
        text.toLowerCase() === 'descargar' ||
        text.toLowerCase() === 'descargar cuenta' ||
        text.toLowerCase() === 'descargar documentos' ||
        text === '/generar' ||
        text.toLowerCase() === 'generar' ||
        text.toLowerCase() === 'generar cuenta' ||
        text.toLowerCase() === 'cuenta' ||
        text.toLowerCase() === 'paquete' ||
        text.toLowerCase() === 'zip' ||
        text.toLowerCase() === 'bajar cuenta'
    ) {
        const user = await User.findOne({ telegramChatId: chatId });
        if (!user) {
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }

        const billingPeriod = await BillingPeriod.findOne({ user: user._id }).sort({ createdAt: -1 });

        if (!billingPeriod) {
            await sendTelegramMessage(chatId, '📭 Aún no tienes periodos registrados en el sistema.');
            return;
        }

        await handleGenerateAndDownload(chatId, user, billingPeriod._id);
        return;
    } else if (
        text === '/word' ||
        text.toLowerCase() === 'word' ||
        text.toLowerCase() === 'formatos' ||
        text.toLowerCase() === 'formatos word' ||
        text.toLowerCase() === 'documentos word'
    ) {
        const user = await User.findOne({ telegramChatId: chatId });
        if (!user) {
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }

        const billingPeriod = await BillingPeriod.findOne({ user: user._id }).sort({ createdAt: -1 });
        if (!billingPeriod) {
            await sendTelegramMessage(chatId, '📭 Aún no tienes periodos registrados en el sistema.');
            return;
        }

        await handleGenerateAndDownload(chatId, user, billingPeriod._id);
        return;
    } else if (
        text === '/resumen' ||
        text.toLowerCase() === 'resumen' ||
        text === '/estado' ||
        text.toLowerCase() === 'estado'
    ) {
        const user = await User.findOne({ telegramChatId: chatId });
        if (!user) {
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }

        const billingPeriod = await BillingPeriod.findOne({ user: user._id }).sort({ createdAt: -1 });
        if (billingPeriod) {
            await showPeriodSummary(chatId, billingPeriod._id);
        } else {
            await showActsMenu(chatId, user);
        }
        return;
    } else if (text === '/planilla' || text.toLowerCase() === 'planilla' || text.toLowerCase() === 'subir planilla' || text.toLowerCase() === 'cargar planilla') {
        const user = await User.findOne({ telegramChatId: chatId });
        if (!user) {
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }

        const billingPeriod = await BillingPeriod.findOne({ user: user._id }).sort({ createdAt: -1 });
        if (!billingPeriod) {
            await promptSecuritySocial(chatId, user);
            return;
        }

        await promptPeriodPlanilla(chatId, billingPeriod._id);
        return;
    } else if (text === '/documentos' || text.toLowerCase() === 'documentos' || text.toLowerCase() === 'cargar documentos' || text.toLowerCase() === 'subir documentos') {
        const user = await User.findOne({ telegramChatId: chatId });
        if (!user) {
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }
        await startContractDocsFlow(chatId, user);
        return;
    } else {
        const user = await User.findOne({ telegramChatId: chatId });
        if (user) {
            const media = extractTelegramFile(message);
            const caption = (message.caption || '').toLowerCase();
            const fileName = (message.document?.file_name || '').toLowerCase();
            const isPlanillaFile = caption.includes('planilla') || caption.includes('seguridad social') || caption.includes('pila') ||
                                   fileName.includes('planilla') || fileName.includes('seguridad') || fileName.includes('pila') || fileName.includes('aporte');

            if (media && isPlanillaFile) {
                const billingPeriod = await BillingPeriod.findOne({ user: user._id }).sort({ createdAt: -1 });
                if (billingPeriod) {
                    sessions.set(chatId, {
                        state: 'awaiting_period_planilla',
                        periodId: billingPeriod._id,
                        actNumber: billingPeriod.actNumber,
                        userId: user._id
                    });
                    await handleIncomingMessage(message);
                    return;
                }
            }

            await sendTelegramKeyboardMessage(chatId, `👋 Hola ${user.fullName}. ¿Qué deseas gestionar hoy?`, [
                [{ text: '📂 Subir Evidencia', callback_data: 'subir_evidencia' }],
                [{ text: '🏥 Subir Planilla SS', callback_data: 'quick_upload_planilla' }],
                [{ text: '📊 Resumen del Acta', callback_data: 'show_acts_menu' }],
                [{ text: '📦 Descargar Paquete ZIP', callback_data: 'download_zip' }]
            ]);
        } else {
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
        }
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
    sendTelegramDocument,
    handleIncomingMessage,
    handleCallbackQuery
};

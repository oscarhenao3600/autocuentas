const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Contract = require('../models/Contract');
const BillingPeriod = require('../models/BillingPeriod');
const TelegramPrivilege = require('../models/TelegramPrivilege');
const PaymentConfig = require('../models/PaymentConfig');
const PaymentReceipt = require('../models/PaymentReceipt');
const geminiService = require('./gemini.service');
const storageService = require('./storage.service');
const { generateBillingPackage } = require('../controllers/billing.controller');
const { calculatePeriods, determineActiveAct, filterSpecificObligations, isGeneralObligation, getContractDurationText } = require('../utils/period.utils');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let lastUpdateId = 0;
let isPolling = false;

// Map to manage user sessions in memory
const sessions = new Map();

/**
 * Downloads a file (photo or document) from Telegram's servers and saves it to Google Drive
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
        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(originalName) || path.extname(filePathOnTelegram) || '.jpg';
        const safeName = `evidence_${obligationIndex}-${uniqueSuffix}${ext}`;
        
        const saved = await storageService.saveFile({
            buffer,
            filename: safeName,
            mimetype: mimeType || 'image/jpeg',
            pathSegments: ['telegram_evidencias']
        });
        
        return {
            filename: originalName || safeName,
            path: saved.path,
            relativePath: saved.path,
            driveId: saved.driveId,
            mimetype: mimeType || 'image/jpeg',
            buffer
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
 * Generic downloader for any Telegram media file directly to Google Drive
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
        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(originalName) || path.extname(filePathOnTelegram) || '.pdf';
        const safeName = `${prefix}_${uniqueSuffix}${ext}`;
        
        const saved = await storageService.saveFile({
            buffer,
            filename: safeName,
            mimetype: mimeType || 'application/pdf',
            pathSegments: ['telegram_docs', prefix]
        });
        
        return {
            filename: originalName || safeName,
            relativePath: saved.path,
            path: saved.path,
            absolutePath: saved.path,
            driveId: saved.driveId,
            mimetype: mimeType,
            buffer
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
    if (!TELEGRAM_TOKEN || !filePath) return;
    try {
        const fileBuffer = await storageService.getFileBuffer(filePath);
        if (!fileBuffer) {
            console.error('⚠️ Archivo no encontrado para enviar por Telegram:', filePath);
            return;
        }

        let filename = path.basename(filePath.replace(/\\/g, '/')) || 'documento.bin';
        if (filename.length > 100) filename = 'documento.bin';

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

        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument?chat_id=${chatId}&caption=${encodeURIComponent(caption || '')}`, {
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
 * Sends an image or document with Inline Keyboard to a chat
 */
const sendTelegramMediaWithKeyboard = async (chatId, filePath, caption, inlineKeyboard = null) => {
    if (!TELEGRAM_TOKEN || !filePath) return null;
    try {
        const fileBuffer = await storageService.getFileBuffer(filePath);
        if (!fileBuffer) {
            console.error('⚠️ Media no encontrada para enviar por Telegram:', filePath);
            return null;
        }

        let filename = path.basename(filePath.replace(/\\/g, '/')) || 'archivo.bin';
        if (filename.length > 100) filename = 'archivo.bin';

        const ext = path.extname(filename).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

        const boundary = '----TelegramMediaBoundary' + Date.now().toString(16);
        let mime = isImage ? (ext === '.png' ? 'image/png' : 'image/jpeg') : 'application/pdf';
        const fieldName = isImage ? 'photo' : 'document';
        const endpoint = isImage ? 'sendPhoto' : 'sendDocument';

        const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`;
        const footer = `\r\n--${boundary}--\r\n`;
        const multipartBody = Buffer.concat([Buffer.from(header, 'utf-8'), fileBuffer, Buffer.from(footer, 'utf-8')]);

        let url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/${endpoint}?chat_id=${chatId}&caption=${encodeURIComponent(caption || '')}`;
        if (inlineKeyboard && inlineKeyboard.length > 0) {
            url += `&reply_markup=${encodeURIComponent(JSON.stringify({ inline_keyboard: inlineKeyboard }))}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: multipartBody
        });

        const data = await response.json();
        if (!data.ok) {
            console.error(`⚠️ Error al enviar media Telegram (${endpoint}):`, data.description);
            return null;
        }
        return data.result;
    } catch (err) {
        console.error('❌ Error en sendTelegramMediaWithKeyboard:', err.message);
        return null;
    }
};

/**
 * Builds the protocolary payment message for individual contractors
 */
const buildContractorPaymentProtocolMessage = (contractorName, actNumber, config) => {
    const rate = config?.contractorRate || 60000;
    const rateFormatted = Number(rate).toLocaleString('es-CO');
    const info = config?.paymentInstructions || {};
    const banco = info.bankName && info.accountNumber ? `${info.bankName} N° ${info.accountNumber}` : 'Bancolombia Ahorros';
    const nequi = info.nequiNumber || 'Por consultar';
    const daviplata = info.daviplataNumber || 'Por consultar';
    const titular = info.accountHolder || 'Administración Cuentas';

    let msg = `🏛️ *SISTEMA DE RADICACIÓN Y GESTIÓN DE CUENTAS DE COBRO*\n\n`;
    msg += `Estimado(a) contratista *${contractorName || 'Funcionario'}*,\n\n`;
    msg += `Reciba un atento y cordial saludo institucional.\n\n`;
    msg += `Le recordamos que la estructuración y generación de su primera cuenta de cobro (*Acta N° 1*) fue otorgada de manera *totalmente gratuita* como cortesía de bienvenida.\n\n`;
    msg += `A partir de su *segunda cuenta de cobro (Acta N° ${actNumber || 2})* en adelante, el servicio de estructuración documental, informes con IA y generación de formatos oficiales opera bajo la tarifa regular:\n\n`;
    msg += `💰 *TARIFA POR CUENTA DE COBRO:* *$ ${rateFormatted} COP*\n\n`;
    msg += `📋 *Beneficios incluidos en su habilitación:*\n`;
    msg += `  ✓ Diligenciamiento automatizado de los 4 formatos oficiales en Word (.docx)\n`;
    msg += `  ✓ Extracción de obligaciones e informes de actividades con Inteligencia Artificial\n`;
    msg += `  ✓ Procesamiento, validación y cruce de Planilla de Seguridad Social (PILA)\n`;
    msg += `  ✓ Organización y rotulado automático de evidencias y anexos en archivo ZIP\n\n`;
    msg += `💳 *Canales y Medios de Pago Habilitados:*\n`;
    msg += `  • *Cuenta Bancaria:* ${banco}\n`;
    msg += `  • *Nequi:* ${nequi}\n`;
    msg += `  • *Daviplata:* ${daviplata}\n`;
    msg += `  • *Titular:* ${titular}\n\n`;
    msg += `📲 *Instrucciones para Habilitación:*\n`;
    msg += `1. Realice la transferencia por *$ ${rateFormatted} COP*.\n`;
    msg += `2. Envíe la captura o fotografía del comprobante de pago directamente a este chat.\n`;
    msg += `3. Nuestro equipo administrativo verificará el soporte y de inmediato quedará habilitado el cargue de sus evidencias y comentarios.`;
    return msg;
};

/**
 * Builds the protocolary payment message for package users
 */
const buildPackagePaymentProtocolMessage = (userName, config) => {
    const pkgRate = config?.packageRate || 100000;
    const pkgRateFormatted = Number(pkgRate).toLocaleString('es-CO');
    const unitRate = config?.packageUnitRate || 20000;
    const unitRateFormatted = Number(unitRate).toLocaleString('es-CO');
    const count = config?.packageAccountsCount || 5;
    const info = config?.paymentInstructions || {};
    const banco = info.bankName && info.accountNumber ? `${info.bankName} N° ${info.accountNumber}` : 'Bancolombia Ahorros';
    const nequi = info.nequiNumber || 'Por consultar';
    const daviplata = info.daviplataNumber || 'Por consultar';
    const titular = info.accountHolder || 'Administración Cuentas';

    let msg = `📦 *PLAN EMPRESARIAL / PAQUETE DE CUENTAS DE COBRO*\n\n`;
    msg += `Estimado(a) *${userName || 'Usuario Gestor'}*,\n\n`;
    msg += `Le damos la bienvenida a la modalidad de *Paquetes de Cuentas*. En este esquema, el servicio se adquiere de manera prepagada sin periodos gratuitos:\n\n`;
    msg += `💰 *CONDICIONES DEL PAQUETE:*\n`;
    msg += `  • *Cantidad de cuentas:* ${count} Cuentas de Cobro\n`;
    msg += `  • *Tarifa preferencial:* $ ${unitRateFormatted} COP por cada cuenta\n`;
    msg += `  • *Inversión total del paquete:* *$ ${pkgRateFormatted} COP*\n\n`;
    msg += `⚠️ *Nota importante:* Para iniciar a ingresar datos, vincular funcionarios o generar cuentas, debe realizar la adquisición previa de su paquete.\n\n`;
    msg += `💳 *Canales de Pago Habilitados:*\n`;
    msg += `  • *Cuenta Bancaria:* ${banco}\n`;
    msg += `  • *Nequi:* ${nequi}\n`;
    msg += `  • *Daviplata:* ${daviplata}\n`;
    msg += `  • *Titular:* ${titular}\n\n`;
    msg += `📲 Por favor realice la transferencia de *$ ${pkgRateFormatted} COP* y envíe el comprobante a este chat para habilitar de inmediato su cupo de ${count} cuentas.`;
    return msg;
};

/**
 * Verifies monetization and access rights for an Act/BillingPeriod.
 * - Act 1: 100% Free for everyone (Bienvenida / Free Trial).
 * - Act 2+: Requires payment, OR exemption, OR package quota.
 */
const checkPeriodAccess = async (chatId, activeUser, actNumber, period = null) => {
    // Act 1 is always FREE (Bienvenida / Primera cuenta sin costo)
    if (actNumber === 1) {
        return {
            allowed: true,
            reason: 'free_trial',
            badge: '1ª Cuenta (Gratis)'
        };
    }

    const config = await PaymentConfig.getConfig();

    // Check if the chat is an active Telegram Operator Privilege
    const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
    if (privilege) {
        // 1. Exempt Operator (100% Free / Unlimited)
        if (privilege.operatorType === 'exempt') {
            return {
                allowed: true,
                reason: 'exempt_operator',
                badge: 'Operador Exento (Sin Costo)',
                privilege
            };
        }

        // 2. Provider with Preferential Rate and Package Quota
        if (privilege.operatorType === 'provider' || (privilege.packageQuota && privilege.packageQuota > 0)) {
            const totalQuota = (privilege.packageQuota || 0) + (privilege.monthlyAccountsLimit || 0);
            const used = (privilege.packageAccountsUsed || 0) + (privilege.accountsUsedThisMonth || 0);

            if (used < totalQuota) {
                return {
                    allowed: true,
                    reason: 'provider',
                    badge: `Paquete (${used}/${totalQuota} cuentas)`,
                    privilege
                };
            } else {
                return {
                    allowed: false,
                    reason: 'package_required',
                    message: buildPackagePaymentProtocolMessage(privilege.label, config),
                    amount: config.packageRate || 100000,
                    paymentType: 'package'
                };
            }
        }
    }

    // Check if user is in Package Plan
    if (activeUser && activeUser.pricingPlan === 'package') {
        const quota = activeUser.packageQuota || 0;
        const used = activeUser.packageAccountsUsed || 0;
        if (used < quota) {
            return {
                allowed: true,
                reason: 'package_user',
                badge: `Paquete (${used}/${quota})`
            };
        } else {
            return {
                allowed: false,
                reason: 'package_required',
                message: buildPackagePaymentProtocolMessage(activeUser.fullName, config),
                amount: config.packageRate || 100000,
                paymentType: 'package'
            };
        }
    }

    // Check if contractor is marked as payment exempt (VIP)
    if (activeUser && activeUser.isPaymentExempt) {
        return {
            allowed: true,
            reason: 'exempt_user',
            badge: 'Funcionario Exento'
        };
    }

    // Check if period is already paid/enabled
    if (period && (period.isPaid || period.paymentStatus === 'paid' || period.paymentStatus === 'exempt')) {
        return {
            allowed: true,
            reason: 'paid',
            badge: 'Cuenta Habilitada'
        };
    }

    // Otherwise, Act 2+ requires payment for regular contractors ($60.000 COP)
    const contractorName = activeUser?.fullName || 'Contratista';
    return {
        allowed: false,
        reason: 'payment_required',
        message: buildContractorPaymentProtocolMessage(contractorName, actNumber, config),
        amount: config.contractorRate || 60000,
        paymentType: 'individual'
    };
};

/**
 * Generates all 4 Word docs + ZIP package and sends it via Telegram
 */
const handleGenerateAndDownload = async (chatId, user, periodId) => {
    try {
        const periodCheck = await BillingPeriod.findById(periodId);
        if (periodCheck && periodCheck.actNumber > 1) {
            const access = await checkPeriodAccess(chatId, user, periodCheck.actNumber, periodCheck);
            if (!access.allowed) {
                await sendTelegramMessage(chatId, access.message);
                return;
            }
        }

        await sendTelegramMessage(chatId, '⚙️ Generando tus 4 formatos oficiales, los documentos "Anexo Descripción" con IA para cada obligación y empaquetando soportes...');

        const { period, zipPath } = await generateBillingPackage(periodId, user._id);

        if (zipPath && (storageService.extractDriveId(zipPath) || fs.existsSync(zipPath))) {
            // Count towards provider monthly usage if applicable
            const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
            if (privilege && privilege.operatorType === 'provider') {
                const now = new Date();
                const currentCycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                if (privilege.currentMonthCycle !== currentCycle) {
                    privilege.currentMonthCycle = currentCycle;
                    privilege.accountsUsedThisMonth = 1;
                } else {
                    privilege.accountsUsedThisMonth = (privilege.accountsUsedThisMonth || 0) + 1;
                }
                await privilege.save();
            }

            await sendTelegramMessage(chatId, `📦 ¡Paquete de Cobro generado con éxito para el Acta N° ${period.actNumber}! Enviando archivo ZIP...`);
            await sendTelegramDocument(chatId, zipPath, `Cuenta de Cobro - Acta ${period.actNumber}`);

            // Mark zip as downloaded in database
            period.zipDownloaded = true;
            period.zipDownloadedAt = new Date();
            await period.save();

            // Check if date exceeds periodTo to evaluate payment status for next period
            const activeContract = period.contract ? await Contract.findById(period.contract) : await resolveActiveContract(chatId, user);
            if (activeContract) {
                await checkAndAdvancePaymentStatus(user, activeContract);
            }

            await sendTelegramKeyboardMessage(chatId, `✅ Paquete de Cobro entregado en formato ZIP.\n\nIncluye:\n• 4 Formatos oficiales Word (.docx)\n• Documentos "Anexo Descripción #[obligación]" con redacción técnica de 100-150 palabras y fotos/pantallazos de soporte\n• Carpetas organizadas con todos tus soportes`, [
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
 * Automatically evaluates whether a contract has completed a period and exceeded its periodTo date.
 * If zip was downloaded and now > periodTo, the next period's payment flag is initialized as pending_payment.
 */
const checkAndAdvancePaymentStatus = async (user, contract) => {
    try {
        if (!contract || !contract.startDate || !user) return;

        const periods = calculatePeriods(
            contract.startDate,
            contract.initialDurationMonths || 4,
            contract.additionDurationMonths || 0,
            contract.periodType || 'mes_cumplido',
            contract.endDate
        );

        const existingPeriods = await BillingPeriod.find({
            user: user._id,
            contract: contract._id
        }).sort({ actNumber: 1 });

        const now = new Date();

        for (const ep of existingPeriods) {
            // Condition: uploaded evidence, downloaded zip, and current date exceeds periodTo
            if (ep.zipDownloaded && ep.periodTo && now > new Date(ep.periodTo)) {
                const nextActNumber = ep.actNumber + 1;
                const nextPeriodConfig = periods.find(p => p.actNumber === nextActNumber);
                if (nextPeriodConfig) {
                    let nextPeriod = existingPeriods.find(p => p.actNumber === nextActNumber);
                    if (!nextPeriod) {
                        const specificObligations = filterSpecificObligations(contract.activities || []);
                        const acts = specificObligations.map((text, i) => {
                            const codeMatch = text.match(/^(\d+(\.\d+)*)\.?\s*(.*)$/);
                            return {
                                obligationCode: codeMatch ? codeMatch[1] : `2.2.${i + 1}`,
                                obligationText: codeMatch ? codeMatch[3] : text,
                                comment: '',
                                evidences: []
                            };
                        });

                        await BillingPeriod.create({
                            user: user._id,
                            contract: contract._id,
                            actNumber: nextActNumber,
                            periodFrom: new Date(nextPeriodConfig.from + 'T00:00:00'),
                            periodTo: new Date(nextPeriodConfig.to + 'T23:59:59'),
                            activities: acts,
                            status: 'pending',
                            isPaid: false,
                            paymentStatus: 'pending_payment'
                        });
                    } else if (!nextPeriod.isPaid) {
                        nextPeriod.paymentStatus = 'pending_payment';
                        nextPeriod.isPaid = false;
                        await nextPeriod.save();
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error en checkAndAdvancePaymentStatus:', err);
    }
};

/**
 * Resolves the current target act for a contract based on contract start date, elapsed calendar time, and download status
 */
const getContractCurrentActiveAct = async (userId, contractId, contract) => {
    try {
        await checkAndAdvancePaymentStatus({ _id: userId }, contract);

        const existingPeriods = await BillingPeriod.find({
            user: userId,
            contract: contractId
        }).sort({ actNumber: 1 });

        const activeResult = determineActiveAct(contract, existingPeriods, new Date());
        const targetAct = activeResult.targetAct;
        const periods = activeResult.periods;
        const currentPeriod = existingPeriods.find(p => p.actNumber === targetAct) || activeResult.currentPeriod || null;

        return {
            targetAct,
            currentPeriod,
            existingPeriods,
            periods,
            reason: activeResult.reason
        };
    } catch (err) {
        console.error('Error en getContractCurrentActiveAct:', err);
        return { targetAct: 1, currentPeriod: null, existingPeriods: [], periods: [] };
    }
};

/**
 * Handles incoming payment receipt (image or document) from user/contractor
 */
const handleIncomingPaymentReceipt = async (chatId, message, user, media) => {
    try {
        const session = sessions.get(chatId) || {};
        const config = await PaymentConfig.getConfig();

        const isPackage = session.paymentType === 'package' || session.awaitingPackagePayment === true || user?.pricingPlan === 'package';
        const actNumber = session.awaitingPaymentForAct || 2;
        const amount = isPackage ? (config.packageRate || 100000) : (config.contractorRate || 60000);

        await sendTelegramMessage(chatId, '⏳ Recibiendo y procesando comprobante de pago...');
        const downloaded = await downloadTelegramMedia(media.fileId, 'payment_receipt', media.originalName, media.mimeType);

        const contract = await resolveActiveContract(chatId, user);
        let period = null;
        if (contract && !isPackage) {
            const query = { user: user._id, contract: contract._id, actNumber: actNumber };
            period = await BillingPeriod.findOne(query);
            if (!period) {
                const periods = calculatePeriods(
                    contract.startDate,
                    contract.initialDurationMonths || 4,
                    contract.additionDurationMonths || 0,
                    contract.periodType || 'mes_cumplido',
                    contract.endDate
                );
                const pConfig = periods.find(p => p.actNumber === actNumber);
                const specificObligations = filterSpecificObligations(contract.activities || []);
                const acts = specificObligations.map((text, i) => {
                    const codeMatch = text.match(/^(\d+(\.\d+)*)\.?\s*(.*)$/);
                    return {
                        obligationCode: codeMatch ? codeMatch[1] : `2.2.${i + 1}`,
                        obligationText: codeMatch ? codeMatch[3] : text,
                        comment: '',
                        evidences: []
                    };
                });
                period = await BillingPeriod.create({
                    user: user._id,
                    contract: contract._id,
                    actNumber: actNumber,
                    periodFrom: pConfig ? new Date(pConfig.from + 'T00:00:00') : new Date(),
                    periodTo: pConfig ? new Date(pConfig.to + 'T23:59:59') : new Date(),
                    activities: acts,
                    status: 'pending',
                    isPaid: false,
                    paymentStatus: 'pending_payment'
                });
            }
        }

        const contractorName = contract?.contractorName || user?.fullName || [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Contratista';
        const contractorCedula = contract?.idNumber || session.cedula || '';
        const telegramUser = message.from?.username ? `@${message.from.username}` : '';
        const senderFullName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || contractorName;

        const receipt = await PaymentReceipt.create({
            user: user._id,
            contract: contract?._id || null,
            billingPeriod: period?._id || null,
            telegramChatId: chatId,
            telegramUsername: telegramUser,
            telegramName: senderFullName,
            contractorName: contractorName,
            contractorCedula: contractorCedula,
            paymentType: isPackage ? 'package' : 'individual',
            actNumber: actNumber,
            packageAccountsCount: 5,
            amount: amount,
            receiptFile: {
                filename: downloaded.filename,
                path: downloaded.relativePath,
                mimetype: downloaded.mimetype
            },
            status: 'pending'
        });

        // Link receipt to period if applicable
        if (period) {
            period.receipt = receipt._id;
            await period.save();
        }

        session.state = 'idle';
        delete session.awaitingPaymentForAct;
        delete session.awaitingPackagePayment;
        delete session.paymentType;
        sessions.set(chatId, session);

        let confMsg = `📨 *COMPROBANTE DE PAGO REGISTRADO EXITOSAMENTE*\n\n`;
        confMsg += `Estimado(a) *${contractorName}*, hemos registrado su soporte de pago por valor de *$ ${Number(amount).toLocaleString('es-CO')} COP* correspondiente a: *${isPackage ? 'Paquete de 5 Cuentas de Cobro' : `Acta N° ${actNumber}`}*.\n\n`;
        confMsg += `🏛️ El comprobante ha sido enviado a la Administración para su validación inmediata.\n`;
        confMsg += `Una vez aprobado, el sistema le enviará una confirmación automática y habilitará el cargue de sus evidencias e información.`;
        await sendTelegramMessage(chatId, confMsg);

        // Forward to admin
        const approvalChatId = config.approvalTelegramChatId;
        if (approvalChatId) {
            const adminCaption = `🔔 *NUEVO COMPROBANTE DE PAGO RECIBIDO*\n\n` +
                `👤 *Funcionario:* ${contractorName}\n` +
                `🪪 *Cédula:* ${contractorCedula || 'No registrada'}\n` +
                `📱 *Telegram ID:* \`${chatId}\` (${telegramUser || senderFullName})\n` +
                `📋 *Concepto:* ${isPackage ? '📦 Paquete de 5 Cuentas de Cobro' : `📄 Cuenta Individual - Acta N° ${actNumber}`}\n` +
                `💰 *Valor a Pagar:* $ ${Number(amount).toLocaleString('es-CO')} COP\n` +
                `🏛️ *Entidad:* ${contract?.entityName || 'Alcaldía de Armenia'}\n` +
                `🕒 *Fecha:* ${new Date().toLocaleString('es-CO')}\n\n` +
                `👉 *Verifique la imagen y seleccione una acción:*`;

            const adminKeyboard = [
                [
                    { text: `✅ Aprobar Pago ($${Number(amount).toLocaleString('es-CO')})`, callback_data: `approve_pay_${receipt._id}` },
                    { text: '❌ Rechazar Pago', callback_data: `reject_pay_${receipt._id}` }
                ]
            ];

            const sent = await sendTelegramMediaWithKeyboard(
                approvalChatId,
                downloaded.absolutePath,
                adminCaption,
                adminKeyboard
            );

            if (sent && sent.message_id) {
                receipt.adminTelegramChatId = approvalChatId;
                receipt.adminTelegramMessageId = sent.message_id;
                await receipt.save();
            }
        } else {
            console.log('ℹ️ [TelegramBot] No hay approvalTelegramChatId configurado en PaymentConfig. El comprobante está en la BD para aprobación desde el panel web.');
        }

        return receipt;
    } catch (err) {
        console.error('❌ Error en handleIncomingPaymentReceipt:', err);
        await sendTelegramMessage(chatId, `❌ Error al registrar el comprobante: ${err.message}`);
    }
};

/**
 * Retrieves all active contracts for a user
 */
const getUserContracts = async (userId) => {
    return await Contract.find({ user: userId, status: { $ne: 'archived' } }).sort({ createdAt: -1 });
};

/**
 * Resolves the currently active User for this chat.
 * If in operator mode, returns the selected funcionario.
 * Otherwise returns the linked User for this chatId.
 */
const resolveActiveUser = async (chatId) => {
    const session = sessions.get(chatId);
    if (session && session.activeUserId) {
        const user = await User.findById(session.activeUserId);
        if (user) return user;
    }
    if (session && session.userId) {
        const user = await User.findById(session.userId);
        if (user) return user;
    }
    return await User.findOne({ telegramChatId: chatId });
};

/**
 * Returns a prominent visual header banner for the active contract and operator status
 */
const getContractBanner = (contract, chatId = null) => {
    let header = '';
    if (chatId) {
        const session = sessions.get(chatId);
        if (session && session.isOperator && session.operatorLabel) {
            header += `🛡️ OPERADOR: ${session.operatorLabel}\n`;
        }
    }
    if (contract) {
        const contractor = contract.contractorName ? ` | ${contract.contractorName}` : '';
        const num = contract.contractNumber || 'En trámite';
        const entity = contract.entityName || contract.supervisorDependency || 'Alcaldía de Armenia';
        const sup = contract.supervisorName || 'No asignado';
        header += `📌 CONTRATO: ${num}${contractor}\n🏛️ ${entity} | Supervisor: ${sup}\n`;
    }
    if (header) {
        header += `──────────────────────\n`;
    }
    return header;
};

/**
 * Resolves the active contract for the session and user.
 * If user has multiple contracts and none is explicitly selected, returns null so selection menu can be triggered.
 */
const resolveActiveContract = async (chatId, user) => {
    const session = sessions.get(chatId);
    if (session && session.activeContractId) {
        const contract = await Contract.findById(session.activeContractId);
        if (contract && contract.user.toString() === user._id.toString()) {
            return contract;
        }
    }
    const contracts = await getUserContracts(user._id);
    if (contracts.length === 1) {
        if (session) {
            session.activeContractId = contracts[0]._id;
            sessions.set(chatId, session);
        } else {
            sessions.set(chatId, { activeContractId: contracts[0]._id });
        }
        return contracts[0];
    }
    return null;
};

/**
 * Displays the menu of available funcionarios for a privileged Telegram operator
 */
const showOperatorFuncionarioMenu = async (chatId, privilege, page = 0, editMessageId = null) => {
    try {
        let allowedUsers = [];
        if (privilege.scope === 'all') {
            allowedUsers = await User.find({ role: { $ne: 'admin' } }).sort({ fullName: 1 });
        } else {
            const ids = Array.isArray(privilege.assignedUsers) ? privilege.assignedUsers : [];
            allowedUsers = await User.find({ _id: { $in: ids }, role: { $ne: 'admin' } }).sort({ fullName: 1 });
        }

        const contracts = await Contract.find().sort({ createdAt: -1 });
        const contractMap = new Map();
        contracts.forEach(c => {
            if (c.user && !contractMap.has(c.user.toString())) {
                contractMap.set(c.user.toString(), c);
            }
        });

        if (allowedUsers.length === 0) {
            const emptyMsg = `🛡️ MODO OPERADOR: ${privilege.label}\n\n⚠️ No se encontraron funcionarios disponibles para gestionar.\n\n${privilege.scope === 'specific' ? 'No tienes funcionarios asignados en tu lista. Solicita al Administrador Maestro que te asigne funcionarios desde el panel web.' : 'Aún no hay contratistas registrados en el sistema.'}`;
            if (editMessageId) {
                await editTelegramMessage(chatId, editMessageId, emptyMsg);
            } else {
                await sendTelegramMessage(chatId, emptyMsg);
            }
            return;
        }

        const pageSize = 8;
        const totalPages = Math.ceil(allowedUsers.length / pageSize);
        const currentPage = Math.min(Math.max(0, page), totalPages - 1);
        const startIdx = currentPage * pageSize;
        const pageUsers = allowedUsers.slice(startIdx, startIdx + pageSize);

        let text = `🛡️ MODO OPERADOR: ${privilege.label}\n`;
        text += `🌐 Alcance: ${privilege.scope === 'all' ? 'Todos los funcionarios (Acceso Maestro)' : `${allowedUsers.length} funcionario(s) asignado(s)`}\n\n`;
        text += `👥 Selecciona el funcionario con el que deseas trabajar:\n\n`;

        const keyboard = [];

        pageUsers.forEach((u) => {
            const c = contractMap.get(u._id.toString());
            const cedula = c?.idNumber || 'Sin C.C.';
            const entity = c?.entityName || c?.supervisorDependency || '';
            const shortEntity = entity.length > 15 ? entity.substring(0, 15) + '...' : entity;
            const labelText = `👤 ${u.fullName} (${cedula})`;

            text += `• ${u.fullName}\n   🪪 C.C. ${cedula}${shortEntity ? ` | ${shortEntity}` : ''}\n`;

            keyboard.push([{
                text: labelText,
                callback_data: `sel_op_user_${u._id}`
            }]);
        });

        text += `\n💡 O escribe directamente el número de cédula del funcionario en cualquier momento.`;

        // Pagination buttons
        if (totalPages > 1) {
            const navRow = [];
            if (currentPage > 0) {
                navRow.push({ text: '⬅️ Anterior', callback_data: `op_page_${currentPage - 1}` });
            }
            navRow.push({ text: `Pág ${currentPage + 1}/${totalPages}`, callback_data: 'noop' });
            if (currentPage < totalPages - 1) {
                navRow.push({ text: 'Siguiente ➡️', callback_data: `op_page_${currentPage + 1}` });
            }
            keyboard.push(navRow);
        }

        if (editMessageId) {
            await editTelegramMessage(chatId, editMessageId, text, keyboard);
        } else {
            await sendTelegramKeyboardMessage(chatId, text, keyboard);
        }
    } catch (err) {
        console.error('Error en showOperatorFuncionarioMenu:', err);
        await sendTelegramMessage(chatId, '❌ Error al listar los funcionarios.');
    }
};

/**
 * Activates an operator's session for a specific funcionario
 */
const selectOperatorUser = async (chatId, privilege, userId, editMessageId = null) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            await sendTelegramMessage(chatId, '⚠️ Funcionario no encontrado.');
            return;
        }

        // Verify scope permissions
        if (privilege.scope === 'specific') {
            const isAssigned = (privilege.assignedUsers || []).some(id => id.toString() === userId.toString());
            if (!isAssigned) {
                await sendTelegramMessage(chatId, '⚠️ No tienes permisos asignados para gestionar a este funcionario.');
                return;
            }
        }

        const contracts = await getUserContracts(user._id);

        const session = sessions.get(chatId) || {};
        session.isOperator = true;
        session.operatorLabel = privilege.label;
        session.privilegeId = privilege._id;
        session.activeUserId = user._id;
        session.userId = user._id;
        session.state = 'identified';
        sessions.set(chatId, session);

        privilege.lastActiveAt = new Date();
        await privilege.save();

        if (contracts.length > 1) {
            let reply = `🛡️ MODO OPERADOR: ${privilege.label}\n\n`;
            reply += `✅ Has seleccionado al funcionario: ${user.fullName}\n`;
            reply += `🏛️ Tiene ${contracts.length} contratos registrados en el sistema.\n`;
            reply += `Por favor selecciona con cuál contrato deseas trabajar:`;
            if (editMessageId) {
                await editTelegramMessage(chatId, editMessageId, reply);
            } else {
                await sendTelegramMessage(chatId, reply);
            }
            await showContractSelectionMenu(chatId, user);
            return;
        }

        const contract = contracts[0] || null;
        if (contract) {
            session.activeContractId = contract._id;
            session.contractId = contract._id;
            sessions.set(chatId, session);
        }

        let reply = `🛡️ MODO OPERADOR: ${privilege.label}\n`;
        reply += `━━━━━━━━━━━━━━━━━━━━\n`;
        reply += `👤 FUNCIONARIO ACTIVO: ${user.fullName}\n`;
        reply += `🪪 Cédula: ${contract?.idNumber || 'Sin cédula'}\n`;
        reply += `📋 Contrato: ${contract?.contractNumber || 'En trámite'}\n`;
        reply += `🏛️ Entidad: ${contract?.entityName || contract?.supervisorDependency || 'Alcaldía de Armenia'}\n`;
        reply += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        if (!contract || !contract.activities || contract.activities.length === 0) {
            reply += `⚠️ Este funcionario aún no tiene obligaciones contractuales cargadas.\n¿Deseas cargar los documentos de su contrato (Minuta, Acta de Inicio, RP, RUT, etc.)?`;
            const keyboard = [
                [{ text: '📄 Cargar Documentos de Contrato', callback_data: 'start_docs_flow' }],
                [{ text: '👥 Cambiar de Funcionario', callback_data: 'operator_switch_user' }]
            ];
            if (editMessageId) {
                await editTelegramMessage(chatId, editMessageId, reply, keyboard);
            } else {
                await sendTelegramKeyboardMessage(chatId, reply, keyboard);
            }
        } else {
            reply += `¿Qué deseas gestionar para ${user.fullName}?`;
            const keyboard = [
                [{ text: '📂 Subir Evidencias', callback_data: 'subir_evidencia' }],
                [{ text: '🏥 Subir Planilla SS', callback_data: 'quick_upload_planilla' }],
                [{ text: '📊 Resumen del Acta', callback_data: 'show_acts_menu' }],
                [{ text: '📦 Descargar Paquete ZIP', callback_data: 'download_zip' }],
                [{ text: '👥 Cambiar de Funcionario', callback_data: 'operator_switch_user' }]
            ];
            if (editMessageId) {
                await editTelegramMessage(chatId, editMessageId, reply, keyboard);
            } else {
                await sendTelegramKeyboardMessage(chatId, reply, keyboard);
            }
        }
    } catch (err) {
        console.error('Error en selectOperatorUser:', err);
        await sendTelegramMessage(chatId, '❌ Error al seleccionar funcionario.');
    }
};

/**
 * Interactive menu to let contractors select which contract to work on
 */
const showContractSelectionMenu = async (chatId, user, editMessageId = null) => {
    try {
        const contracts = await getUserContracts(user._id);

        if (contracts.length === 0) {
            const emptyMsg = `⚠️ No tienes contratos registrados en el sistema.\n\nPuedes presionar el botón abajo para registrar tu primer contrato cargando su minuta:`;
            const keyboard = [
                [{ text: '➕ Registrar Nuevo Contrato', callback_data: 'add_new_contract' }]
            ];
            if (sessions.get(chatId)?.isOperator) {
                keyboard.push([{ text: '👥 Cambiar de Funcionario', callback_data: 'operator_switch_user' }]);
            }
            if (editMessageId) {
                await editTelegramMessage(chatId, editMessageId, emptyMsg, keyboard);
            } else {
                await sendTelegramKeyboardMessage(chatId, emptyMsg, keyboard);
            }
            return;
        }

        const isOp = sessions.get(chatId)?.isOperator;
        let text = isOp ? `🛡️ MODO OPERADOR: ${sessions.get(chatId)?.operatorLabel || ''}\n👤 Funcionario: ${user.fullName}\n\n` : '';
        text += `🏛️ Selección de Contrato\n\n`;
        text += `Funcionario: ${user.fullName} tiene ${contracts.length} contrato(s) registrado(s) en el sistema.\n\n`;
        text += `👉 Selecciona el contrato con el que deseas trabajar:\n\n`;

        const keyboard = [];

        contracts.forEach((c, idx) => {
            const num = c.contractNumber || 'En trámite';
            const entity = c.entityName || c.supervisorDependency || 'Alcaldía';
            const icon = idx === 0 ? '1️⃣' : idx === 1 ? '2️⃣' : idx === 2 ? '3️⃣' : '📄';
            text += `${icon} Contrato N° ${num}\n`;
            text += `   🏢 Entidad: ${entity}\n`;
            text += `   👤 Supervisor: ${c.supervisorName || 'No asignado'}\n\n`;

            const shortEntity = entity.length > 22 ? entity.substring(0, 22) + '...' : entity;
            keyboard.push([{
                text: `${icon} ${num} | ${shortEntity}`,
                callback_data: `select_contract_${c._id}`
            }]);
        });

        keyboard.push([
            { text: '➕ Registrar Nuevo Contrato', callback_data: 'add_new_contract' }
        ]);

        if (isOp) {
            keyboard.push([
                { text: '👥 Cambiar de Funcionario', callback_data: 'operator_switch_user' }
            ]);
        }

        if (editMessageId) {
            await editTelegramMessage(chatId, editMessageId, text, keyboard);
        } else {
            await sendTelegramKeyboardMessage(chatId, text, keyboard);
        }
    } catch (err) {
        console.error('Error en showContractSelectionMenu:', err);
        await sendTelegramMessage(chatId, '❌ Error al cargar la lista de contratos.');
    }
};

/**
 * Renders the Act Selection Menu
 */
const showActsMenu = async (chatId, user, editMessageId = null) => {
    try {
        const contract = await resolveActiveContract(chatId, user);
        if (!contract) {
            const contracts = await getUserContracts(user._id);
            if (contracts.length > 1) {
                await showContractSelectionMenu(chatId, user, editMessageId);
                return;
            }
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

        const existingPeriods = await BillingPeriod.find({
            user: user._id,
            $or: [{ contract: contract._id }, { contract: null }]
        });

        const banner = getContractBanner(contract);
        let text = `${banner}📂 Gestión de Evidencias\n\nSelecciona el número de Acta de Cobro para la cual deseas cargar evidencias y comentarios:`;
        const keyboard = [];

        for (const p of periods) {
            const existing = existingPeriods.find(ep => ep.actNumber === p.actNumber);
            const access = await checkPeriodAccess(chatId, user, p.actNumber, existing);
            let statusLabel = '';

            if (existing) {
                if (existing.status === 'approved') statusLabel = ' (Aprobada)';
                else if (existing.status === 'rejected') statusLabel = ' (Rechazada)';
                else if (!access.allowed) statusLabel = ' (Pago Requerido)';
                else statusLabel = ' (Borrador)';
            } else {
                if (p.actNumber === 1) statusLabel = ' (1ª Gratuita)';
                else if (!access.allowed) statusLabel = ' (Pago Requerido)';
                else statusLabel = ' (Sin iniciar)';
            }

            keyboard.push([{
                text: `Acta N. ${p.actNumber}${statusLabel}`,
                callback_data: `select_act_${p.actNumber}`
            }]);
        }

        keyboard.push([
            { text: '🔄 Cambiar de Contrato', callback_data: 'switch_contract' }
        ]);

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
        const contract = await resolveActiveContract(chatId, user);
        if (!contract) {
            const contracts = await getUserContracts(user._id);
            if (contracts.length > 1) {
                await showContractSelectionMenu(chatId, user, editMessageId);
                return;
            }
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
            contract: contract._id,
            actNumber: actNumber,
            status: 'pending'
        });

        if (!period) {
            period = await BillingPeriod.findOne({
                user: user._id,
                contract: contract._id,
                actNumber: actNumber
            });
        }

        // Backwards compatibility for periods created before multi-contract (where contract was null)
        if (!period) {
            const legacyPeriod = await BillingPeriod.findOne({
                user: user._id,
                actNumber: actNumber,
                contract: null
            });
            if (legacyPeriod) {
                legacyPeriod.contract = contract._id;
                await legacyPeriod.save();
                period = legacyPeriod;
            }
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
            const isAct1 = actNumber === 1;
            period = await BillingPeriod.create({
                user: user._id,
                contract: contract._id,
                actNumber: actNumber,
                periodFrom: new Date(periodInfo.from + 'T00:00:00'),
                periodTo: new Date(periodInfo.to + 'T23:59:59'),
                activities: buildInitialActivities(),
                status: 'pending',
                isPaid: isAct1 || Boolean(user.isPaymentExempt),
                paymentStatus: user.isPaymentExempt ? 'exempt' : (isAct1 ? 'free_trial' : 'pending_payment'),
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
            const banner = getContractBanner(contract);
            const text = `${banner}⚠️ El Acta N. ${actNumber} ya ha sido Aprobada y no se puede modificar.\n\nPor favor selecciona otra acta.`;
            const keyboard = [
                [{ text: 'Volver a las Actas', callback_data: 'go_back_acts' }],
                [{ text: '🔄 Cambiar de Contrato', callback_data: 'switch_contract' }]
            ];
            if (editMessageId) {
                await editTelegramMessage(chatId, editMessageId, text, keyboard);
            } else {
                await sendTelegramKeyboardMessage(chatId, text, keyboard);
            }
            return;
        }

        // Check monetization & payment access
        const access = await checkPeriodAccess(chatId, user, actNumber, period);
        if (!access.allowed) {
            const banner = getContractBanner(contract, chatId);
            const text = `${banner}\n${access.message}`;

            const session = sessions.get(chatId) || {};
            session.state = 'awaiting_payment_receipt';
            session.awaitingPaymentForAct = actNumber;
            session.paymentType = access.paymentType || 'individual';
            sessions.set(chatId, session);

            const keyboard = [
                [{ text: `📷 Adjuntar Comprobante ($${Number(access.amount || 60000).toLocaleString('es-CO')})`, callback_data: access.paymentType === 'package' ? 'pay_package' : `pay_act_${actNumber}` }],
                [{ text: '💳 Ver Medios de Pago', callback_data: 'view_payment_methods' }]
            ];
            if (access.paymentType !== 'package') {
                keyboard.push([{ text: '📦 Comprar Paquete (5 Cuentas x $100.000)', callback_data: 'buy_package' }]);
            }
            keyboard.push([{ text: '📁 Volver a las Actas', callback_data: 'show_acts_menu' }]);
            keyboard.push([{ text: '🔄 Cambiar de Contrato', callback_data: 'switch_contract' }]);

            if (sessions.get(chatId)?.isOperator) {
                keyboard.push([{ text: '👥 Cambiar de Funcionario', callback_data: 'operator_switch_user' }]);
            }
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
            const emptyMsg = `⚠️ El Contrato N° ${contract.contractNumber || 'registrado'} aún no tiene obligaciones registradas en el sistema.\n\nPuedes subir la minuta escribiendo /documentos para extraerlas automáticamente.`;
            const keyboard = [
                [{ text: '🔄 Cambiar de Contrato', callback_data: 'switch_contract' }]
            ];
            if (editMessageId) {
                await editTelegramMessage(chatId, editMessageId, emptyMsg, keyboard);
            } else {
                await sendTelegramKeyboardMessage(chatId, emptyMsg, keyboard);
            }
            return;
        }

        const fromStr = period.periodFrom ? period.periodFrom.toISOString().split('T')[0] : periodInfo.from;
        const toStr = period.periodTo ? period.periodTo.toISOString().split('T')[0] : periodInfo.to;

        const banner = getContractBanner(contract);
        let text = `${banner}📋 ¿Para cuál obligación es a la que se le va a subir dicha evidencia?\n\n`;
        text += `Acta de Cobro N. ${actNumber} (Periodo: ${fromStr} al ${toStr})\n`;
        text += `──────────────────────\n`;
        text += `Lista de obligaciones del contrato:\n\n`;

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
            { text: '📁 Cambiar de Acta', callback_data: 'show_acts_menu' },
            { text: '🔄 Cambiar de Contrato', callback_data: 'switch_contract' }
        ]);

        text += `👉 Toca el botón de la obligación o escribe su número (ej: 1, 2, 3...):`;

        sessions.set(chatId, {
            state: 'awaiting_obligation_selection',
            periodId: period._id,
            actNumber: actNumber,
            activeContractId: contract._id
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
    const contract = await resolveActiveContract(chatId, user);
    if (!contract) {
        const contracts = await getUserContracts(user._id);
        if (contracts.length > 1) {
            await showContractSelectionMenu(chatId, user, editMessageId);
            return;
        }
        await sendTelegramMessage(chatId, '⚠️ Sin contrato configurado. Escribe /documentos para comenzar.');
        return;
    }

    let actNumber = forcedActNumber;
    if (!actNumber) {
        const activePeriod = await BillingPeriod.findOne({
            user: user._id,
            $or: [{ contract: contract._id }, { contract: null }],
            status: 'pending'
        }).sort({ actNumber: 1 });
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

        const contract = period.contract ? await Contract.findById(period.contract) : await resolveActiveContract(chatId, user);

        const access = await checkPeriodAccess(chatId, user, period.actNumber, period);
        if (!access.allowed) {
            await sendTelegramMessage(chatId, access.message);
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
            obligationIndex: index,
            activeContractId: contract ? contract._id : null
        });

        const banner = contract ? getContractBanner(contract) : '';
        let text = `${banner}📌 Obligación ${index + 1} (${act.obligationCode}):\n\n`;
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

        const contract = period.contract ? await Contract.findById(period.contract) : await Contract.findOne({ user: period.user }).sort({ createdAt: -1 });
        const banner = contract ? getContractBanner(contract) : '';

        const totalCount = period.activities.length;
        const readyCount = period.activities.filter(a => a.comment && a.evidences && a.evidences.length > 0).length;
        const partialCount = period.activities.filter(a => (a.comment || (a.evidences && a.evidences.length > 0)) && !(a.comment && a.evidences && a.evidences.length > 0)).length;

        let text = `${banner}Resumen de Carga - Acta N. ${period.actNumber}\n\n`;
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
            { text: '📁 Cambiar de Acta', callback_data: 'show_acts_menu' },
            { text: '🔄 Cambiar de Contrato', callback_data: 'switch_contract' }
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

        const activeUser = await resolveActiveUser(chatId);
        const access = await checkPeriodAccess(chatId, activeUser, period.actNumber, period);
        if (!access.allowed) {
            await sendTelegramMessage(chatId, access.message);
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
        const contract = await resolveActiveContract(chatId, user) || await Contract.findOne({ user: user._id }).sort({ createdAt: -1 });
        sessions.set(chatId, {
            state: 'identified',
            userId: user._id,
            activeContractId: contract ? contract._id : null,
            contractId: contract ? contract._id : null,
            cedula: contract ? contract.idNumber : ''
        });

        const oblCount = (contract && contract.activities) ? contract.activities.length : 0;
        let summaryMsg = `🎉 ¡Carga y procesamiento de documentos finalizada!\n\n`;
        summaryMsg += `📋 Resumen de tu Contrato:\n`;
        summaryMsg += `• Funcionario: ${contract ? (contract.contractorName || user.fullName) : user.fullName}\n`;
        summaryMsg += `• Cédula: ${contract ? (contract.idNumber || 'N/A') : 'N/A'}\n`;
        summaryMsg += `• Contrato N°: ${contract && contract.contractNumber ? contract.contractNumber : 'Pendiente'}\n`;
        summaryMsg += `• Entidad: ${contract ? (contract.entityName || contract.supervisorDependency || 'Alcaldía de Armenia') : 'Alcaldía de Armenia'}\n`;
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
            [{ text: '📦 Descargar Paquete ZIP', callback_data: 'download_zip' }],
            [{ text: '🔄 Cambiar de Contrato', callback_data: 'switch_contract' }]
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

    // ── Payment & Approval Callbacks ─────────────────────────────
    if (data.startsWith('approve_pay_')) {
        const paymentId = data.replace('approve_pay_', '');
        const payment = await PaymentReceipt.findById(paymentId).populate('user').populate('contract');
        if (!payment) {
            await sendTelegramMessage(chatId, '❌ Comprobante de pago no encontrado.');
            return;
        }

        if (payment.status === 'approved') {
            await sendTelegramMessage(chatId, 'ℹ️ Este comprobante de pago ya fue aprobado previamente.');
            return;
        }

        payment.status = 'approved';
        payment.approvedAt = new Date();
        payment.approvedBy = `Admin Telegram (${chatId})`;
        payment.rejectionReason = '';
        await payment.save();

        if (payment.paymentType === 'individual') {
            const query = { user: payment.user._id, actNumber: payment.actNumber };
            if (payment.contract) query.contract = payment.contract._id;
            let targetPeriod = await BillingPeriod.findOne(query);

            if (!targetPeriod && payment.contract) {
                targetPeriod = await BillingPeriod.create({
                    user: payment.user._id,
                    contract: payment.contract._id,
                    actNumber: payment.actNumber,
                    periodFrom: new Date(),
                    periodTo: new Date(),
                    status: 'pending',
                    isPaid: true,
                    paymentStatus: 'paid',
                    paymentDate: new Date(),
                    paymentAmount: payment.amount || 60000,
                    receipt: payment._id
                });
            } else if (targetPeriod) {
                targetPeriod.isPaid = true;
                targetPeriod.paymentStatus = 'paid';
                targetPeriod.paymentDate = new Date();
                targetPeriod.paymentAmount = payment.amount || 60000;
                targetPeriod.receipt = payment._id;
                await targetPeriod.save();
            }
        } else if (payment.paymentType === 'package') {
            const quota = payment.packageAccountsCount || 5;
            if (payment.user) {
                const u = await User.findById(payment.user._id || payment.user);
                if (u) {
                    u.packageQuota = (u.packageQuota || 0) + quota;
                    u.pricingPlan = 'package';
                    await u.save();
                }
            }
            if (payment.telegramChatId) {
                const priv = await TelegramPrivilege.findOne({ telegramChatId: payment.telegramChatId });
                if (priv) {
                    priv.packageQuota = (priv.packageQuota || 0) + quota;
                    await priv.save();
                }
            }
        }

        // Edit Admin message with approval feedback
        const approvedSummary = `✅ *PAGO APROBADO EXITOSAMENTE*\n\n` +
            `👤 *Funcionario:* ${payment.contractorName}\n` +
            `🪪 *Cédula:* ${payment.contractorCedula || 'N/A'}\n` +
            `💰 *Valor:* $ ${Number(payment.amount).toLocaleString('es-CO')} COP\n` +
            `📋 *Concepto:* ${payment.paymentType === 'package' ? '📦 Paquete 5 Cuentas' : `📄 Acta N° ${payment.actNumber}`}\n` +
            `🕒 *Aprobado:* ${new Date().toLocaleString('es-CO')}\n` +
            `👮 *Aprobador:* Admin (${chatId})`;
        await editTelegramMessage(chatId, messageId, approvedSummary, []);

        // Notify Contractor on Telegram!
        if (payment.telegramChatId) {
            try {
                if (payment.paymentType === 'package') {
                    let msg = `🎉 *¡PAGO DE PAQUETE APROBADO CON ÉXITO!*\n\n`;
                    msg += `Estimado(a) *${payment.contractorName}*, le confirmamos que su pago de *$ ${Number(payment.amount).toLocaleString('es-CO')} COP* por el *Paquete de 5 Cuentas* ha sido verificado y aprobado por la Administración.\n\n`;
                    msg += `📦 Cuentas asignadas a su cupo: *5 cuentas*.\n`;
                    msg += `Ya puede iniciar la creación de cuentas y cargue de evidencias sin restricciones.`;
                    await sendTelegramMessage(payment.telegramChatId, msg);
                } else {
                    let msg = `🎉 *¡PAGO APROBADO CON ÉXITO!*\n\n`;
                    msg += `Estimado(a) *${payment.contractorName}*, le confirmamos que su pago de *$ ${Number(payment.amount).toLocaleString('es-CO')} COP* para su *Acta N° ${payment.actNumber}* ha sido verificado y aprobado por la Administración.\n\n`;
                    msg += `✅ El sistema ha quedado habilitado para que pueda cargar sus evidencias y comentarios.\n\n`;
                    msg += `Presione el botón abajo para comenzar:`;
                    await sendTelegramKeyboardMessage(payment.telegramChatId, msg, [
                        [{ text: `📂 Subir Evidencias (Acta ${payment.actNumber})`, callback_data: `select_act_${payment.actNumber}` }],
                        [{ text: '🏥 Subir Planilla SS', callback_data: 'quick_upload_planilla' }]
                    ]);
                }
            } catch (notifyErr) {
                console.error('Error al notificar al contratista:', notifyErr.message);
            }
        }
        return;
    } else if (data.startsWith('reject_pay_')) {
        const paymentId = data.replace('reject_pay_', '');
        const payment = await PaymentReceipt.findById(paymentId);
        if (!payment) {
            await sendTelegramMessage(chatId, '❌ Comprobante no encontrado.');
            return;
        }

        payment.status = 'rejected';
        payment.rejectionReason = 'Rechazado por el Administrador';
        await payment.save();

        const rejectedSummary = `❌ *PAGO RECHAZADO*\n\n` +
            `👤 *Funcionario:* ${payment.contractorName}\n` +
            `🪪 *Cédula:* ${payment.contractorCedula || 'N/A'}\n` +
            `💰 *Valor:* $ ${Number(payment.amount).toLocaleString('es-CO')} COP\n` +
            `🕒 *Rechazado el:* ${new Date().toLocaleString('es-CO')}\n` +
            `👮 *Admin:* ${chatId}`;
        await editTelegramMessage(chatId, messageId, rejectedSummary, []);

        if (payment.telegramChatId) {
            try {
                let msg = `⚠️ *NOVEDAD CON SU COMPROBANTE DE PAGO*\n\n`;
                msg += `Estimado(a) *${payment.contractorName}*, la administración ha revisado el soporte de pago enviado y no fue posible validarlo.\n\n`;
                msg += `Por favor verifique la transferencia y envíe un nuevo comprobante legible con el valor correspondiente ($ ${Number(payment.amount).toLocaleString('es-CO')} COP), o comuníquese con el Administrador.`;
                await sendTelegramKeyboardMessage(payment.telegramChatId, msg, [
                    [{ text: '📷 Enviar Nuevo Comprobante', callback_data: payment.paymentType === 'package' ? 'pay_package' : `pay_act_${payment.actNumber || 2}` }]
                ]);
            } catch (notifyErr) {
                console.error('Error al notificar rechazo:', notifyErr.message);
            }
        }
        return;
    } else if (data.startsWith('pay_act_')) {
        const actNum = parseInt(data.replace('pay_act_', ''), 10) || 2;
        const session = sessions.get(chatId) || {};
        session.state = 'awaiting_payment_receipt';
        session.awaitingPaymentForAct = actNum;
        session.paymentType = 'individual';
        sessions.set(chatId, session);

        const config = await PaymentConfig.getConfig();
        const rate = config.contractorRate || 60000;

        let msg = `📸 *CARGA DE COMPROBANTE DE PAGO (ACTA N° ${actNum})*\n\n`;
        msg += `Tarifa a cancelar: *$ ${Number(rate).toLocaleString('es-CO')} COP*\n\n`;
        msg += `Por favor, adjunta en este momento la fotografía, captura de pantalla o archivo PDF de tu comprobante de transferencia.\n\n`;
        msg += `💡 O presiona el botón abajo para consultar los medios de pago:`;

        await sendTelegramKeyboardMessage(chatId, msg, [
            [{ text: '💳 Ver Medios de Pago', callback_data: 'view_payment_methods' }],
            [{ text: '❌ Cancelar', callback_data: 'show_acts_menu' }]
        ]);
        return;
    } else if (data === 'pay_package' || data === 'buy_package') {
        const session = sessions.get(chatId) || {};
        session.state = 'awaiting_payment_receipt';
        session.paymentType = 'package';
        session.awaitingPackagePayment = true;
        sessions.set(chatId, session);

        const config = await PaymentConfig.getConfig();
        const pkgRate = config.packageRate || 100000;
        const count = config.packageAccountsCount || 5;

        let msg = `📦 *CARGA DE COMPROBANTE - PAQUETE DE ${count} CUENTAS*\n\n`;
        msg += `Tarifa del paquete: *$ ${Number(pkgRate).toLocaleString('es-CO')} COP*\n`;
        msg += `Tarifa unitaria: $ 20.000 COP por cuenta.\n\n`;
        msg += `Por favor, adjunta la fotografía, captura de pantalla o PDF de tu comprobante de pago por *$ ${Number(pkgRate).toLocaleString('es-CO')} COP*.\n\n`;
        msg += `Una vez validado, se acreditarán ${count} cuentas a tu saldo de inmediato.`;

        await sendTelegramKeyboardMessage(chatId, msg, [
            [{ text: '💳 Ver Medios de Pago', callback_data: 'view_payment_methods' }],
            [{ text: '❌ Cancelar', callback_data: 'show_acts_menu' }]
        ]);
        return;
    } else if (data === 'view_payment_methods') {
        const config = await PaymentConfig.getConfig();
        const info = config.paymentInstructions || {};
        const banco = info.bankName && info.accountNumber ? `${info.bankName} N° ${info.accountNumber}` : 'Bancolombia Ahorros';
        const nequi = info.nequiNumber || 'Por consultar';
        const daviplata = info.daviplataNumber || 'Por consultar';
        const titular = info.accountHolder || 'Administración Cuentas';

        let msg = `💳 *MEDIOS DE PAGO OFICIALES*\n\n`;
        msg += `• *Cuenta Bancaria:* ${banco}\n`;
        msg += `• *Nequi:* ${nequi}\n`;
        msg += `• *Daviplata:* ${daviplata}\n`;
        msg += `• *Titular:* ${titular}\n`;
        if (info.identification) msg += `• *Documento / NIT:* ${info.identification}\n`;
        msg += `\n*Tarifas Vigentes:*\n`;
        msg += `• Cuenta individual (Acta 2+): *$ ${Number(config.contractorRate || 60000).toLocaleString('es-CO')} COP*\n`;
        msg += `• Paquete de 5 cuentas: *$ ${Number(config.packageRate || 100000).toLocaleString('es-CO')} COP* ($ 20.000 c/u)\n\n`;
        msg += `Una vez realizada la transferencia, adjunta la imagen del comprobante en este chat:`;

        const session = sessions.get(chatId);
        const actNum = session?.awaitingPaymentForAct || 2;

        await sendTelegramKeyboardMessage(chatId, msg, [
            [{ text: '📷 Adjuntar Comprobante de Cuenta Individual', callback_data: `pay_act_${actNum}` }],
            [{ text: '📦 Adjuntar Comprobante de Paquete (5 Cuentas)', callback_data: 'pay_package' }],
            [{ text: '⬅️ Volver', callback_data: 'show_acts_menu' }]
        ]);
        return;
    }

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

    // Operator Specific Callbacks
    if (data === 'noop') {
        return;
    }
    if (data === 'operator_switch_user' || data === 'switch_operator_user') {
        const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
        if (privilege) {
            await showOperatorFuncionarioMenu(chatId, privilege, 0, messageId);
            return;
        }
    }
    if (data.startsWith('op_page_')) {
        const page = parseInt(data.replace('op_page_', ''), 10) || 0;
        const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
        if (privilege) {
            await showOperatorFuncionarioMenu(chatId, privilege, page, messageId);
            return;
        }
    }
    if (data.startsWith('sel_op_user_')) {
        const targetUserId = data.replace('sel_op_user_', '');
        const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
        if (privilege) {
            await selectOperatorUser(chatId, privilege, targetUserId, messageId);
            return;
        }
    }

    let user = await resolveActiveUser(chatId);
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
        const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
        if (privilege) {
            await showOperatorFuncionarioMenu(chatId, privilege, 0, messageId);
            return;
        }
        await sendTelegramMessage(chatId, '⚠️ Tu cuenta no está asociada. Envía un saludo (hola) para identificarte o registrarte.');
        return;
    }

    // Multi-Contract Switching & Creation Callbacks
    if (data === 'switch_contract' || data === 'show_contracts_menu') {
        await showContractSelectionMenu(chatId, user, messageId);
        return;
    } else if (data.startsWith('select_contract_')) {
        const contractId = data.replace('select_contract_', '');
        const contract = await Contract.findById(contractId);
        if (!contract || contract.user.toString() !== user._id.toString()) {
            await sendTelegramMessage(chatId, '⚠️ Contrato no encontrado o no pertenece a tu usuario.');
            return;
        }

        const session = sessions.get(chatId) || {};
        session.activeContractId = contract._id;
        session.contractId = contract._id;
        session.state = 'idle';
        sessions.set(chatId, session);

        let msg = `✅ Contrato Seleccionado:\n\n`;
        msg += `📌 Contrato N°: ${contract.contractNumber || 'En trámite'}\n`;
        msg += `🏛️ Entidad: ${contract.entityName || contract.supervisorDependency || 'Alcaldía de Armenia'}\n`;
        msg += `👤 Supervisor: ${contract.supervisorName || 'No asignado'}\n`;
        msg += `📅 Vigencia: ${contract.startDate ? contract.startDate.split('T')[0] : 'N/A'} al ${contract.endDate ? contract.endDate.split('T')[0] : 'N/A'}\n`;
        msg += `⏱️ Plazo: ${getContractDurationText(contract)}\n`;
        msg += `📝 Obligaciones: ${contract.activities ? contract.activities.length : 0} registradas\n\n`;

        // Check if current target act requires payment
        const { targetAct, currentPeriod } = await getContractCurrentActiveAct(user._id, contract._id, contract);
        const access = await checkPeriodAccess(chatId, user, targetAct, currentPeriod);

        if (!access.allowed) {
            session.state = 'awaiting_payment_receipt';
            session.awaitingPaymentForAct = targetAct;
            session.paymentType = access.paymentType || 'individual';
            sessions.set(chatId, session);

            const paymentKeyboard = [
                [{ text: `📷 Adjuntar Comprobante ($${Number(access.amount || 60000).toLocaleString('es-CO')})`, callback_data: access.paymentType === 'package' ? 'pay_package' : `pay_act_${targetAct}` }],
                [{ text: '💳 Ver Medios de Pago', callback_data: 'view_payment_methods' }]
            ];
            if (access.paymentType !== 'package') {
                paymentKeyboard.push([{ text: '📦 Comprar Paquete (5 Cuentas x $100.000)', callback_data: 'buy_package' }]);
            }
            paymentKeyboard.push([{ text: '📊 Resumen del Acta', callback_data: 'show_acts_menu' }]);
            if (sessions.get(chatId)?.isOperator) {
                paymentKeyboard.push([{ text: '👥 Cambiar de Funcionario', callback_data: 'operator_switch_user' }]);
            } else {
                paymentKeyboard.push([{ text: '🔄 Cambiar de Contrato', callback_data: 'switch_contract' }]);
            }

            if (messageId) {
                await editTelegramMessage(chatId, messageId, `${msg}\n${access.message}`, paymentKeyboard);
            } else {
                await sendTelegramKeyboardMessage(chatId, `${msg}\n${access.message}`, paymentKeyboard);
            }
            return;
        }

        msg += `¿Qué deseas gestionar para este contrato?`;

        const keyboard = [
            [{ text: '📂 Subir Evidencia', callback_data: 'subir_evidencia' }],
            [{ text: '🏥 Subir Planilla SS', callback_data: 'quick_upload_planilla' }],
            [{ text: '📊 Resumen del Acta', callback_data: 'show_acts_menu' }],
            [{ text: '📦 Descargar Paquete ZIP', callback_data: 'download_zip' }]
        ];

        if (sessions.get(chatId)?.isOperator) {
            keyboard.push([{ text: '👥 Cambiar de Funcionario', callback_data: 'operator_switch_user' }]);
        } else {
            keyboard.push([{ text: '🔄 Cambiar de Contrato', callback_data: 'switch_contract' }]);
        }

        if (messageId) {
            await editTelegramMessage(chatId, messageId, msg, keyboard);
        } else {
            await sendTelegramKeyboardMessage(chatId, msg, keyboard);
        }
        return;
    } else if (data === 'add_new_contract') {
        sessions.set(chatId, {
            state: 'awaiting_new_contract_minuta',
            userId: user._id
        });
        let msg = `📄 Registro de Nuevo Contrato\n\n`;
        msg += `Por favor, adjunta en este momento el archivo PDF de la minuta del nuevo contrato (o acta de inicio).\n\n`;
        msg += `🤖 La Inteligencia Artificial analizará el documento, identificará la entidad (Alcaldía / Gobernación / Secretaría), número de contrato, valores, supervisor y todas las obligaciones contractuales, creando tu nuevo contrato de forma 100% independiente.\n\n`;
        msg += `💡 O escribe /cancelar para volver.`;

        if (messageId) {
            await editTelegramMessage(chatId, messageId, msg, [
                [{ text: '❌ Cancelar', callback_data: 'switch_contract' }]
            ]);
        } else {
            await sendTelegramKeyboardMessage(chatId, msg, [
                [{ text: '❌ Cancelar', callback_data: 'switch_contract' }]
            ]);
        }
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
        const contract = await resolveActiveContract(chatId, user);
        const query = { user: user._id };
        if (contract) query.contract = contract._id;
        const billingPeriod = await BillingPeriod.findOne(query).sort({ createdAt: -1 });
        if (!billingPeriod) {
            await sendTelegramMessage(chatId, '📭 Aún no tienes periodos registrados en el sistema para este contrato.');
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
        const contract = await resolveActiveContract(chatId, user);
        const query = { user: user._id };
        if (contract) query.contract = contract._id;
        const billingPeriod = await BillingPeriod.findOne(query).sort({ createdAt: -1 });
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
            comment: (act && act.comment) || 'Actividad desarrollada en el periodo',
            activeContractId: period ? period.contract : null
        });
        await sendTelegramKeyboardMessage(chatId, `📸 Envía la foto o soporte para la Obligación ${oblCode}.\n\n💡 *Recomendación:* Si vas a enviar varias fotos, escribe en el *pie de foto (caption)* la descripción de cada una para que queden identificadas individualmente en tu Informe de Actividades. Para documentos (PDF o Excel), puedes enviarlos directamente ya que se agrupan y referencian en un solo enunciado.`, [
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
 * Checks if incoming text requests to view or switch contracts
 */
function isContratosCommand(str) {
    if (!str) return false;
    const clean = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return /^((\/)?contratos?|mis\s*contratos?|cambiar\s*contrato|cambiar\s*de\s*contrato|seleccionar\s*contrato|lista\s*de\s*contratos)(\s.*|[!.,;:]*)?$/i.test(clean);
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

    // 0. ID Discovery Command (Always accessible to anyone)
    if (text === '/id' || text === '/mi_id' || text.toLowerCase() === 'id' || text.toLowerCase() === 'mi id') {
        const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId });
        const user = await User.findOne({ telegramChatId: chatId });
        const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Usuario';
        const senderUser = message.from?.username ? `@${message.from.username}` : 'sin alias';

        let msg = `🆔 Tu Telegram Chat ID es: ${chatId}\n\n`;
        msg += `👤 Nombre en Telegram: ${senderName} (${senderUser})\n`;

        if (privilege) {
            msg += `🛡️ Rol: OPERADOR AUTORIZADO (${privilege.isActive ? 'ACTIVO' : 'INACTIVO'})\n`;
            msg += `🏷️ Nombre Operador: ${privilege.label}\n`;
            msg += `🌐 Alcance: ${privilege.scope === 'all' ? 'Todos los funcionarios (Acceso Global Maestro)' : `${privilege.assignedUsers?.length || 0} funcionario(s) asignado(s)`}\n\n`;
            msg += `💡 Usa el comando /funcionario para cambiar de funcionario en cualquier momento.`;
        } else if (user) {
            msg += `✅ Vinculado a funcionario: ${user.fullName} (${user.email})\n\n`;
            msg += `👉 Si necesitas gestionar cuentas de cobro de otros funcionarios desde este chat, entrega este ID (${chatId}) al Administrador Maestro en el panel web para recibir privilegios multicuenta.`;
        } else {
            msg += `ℹ️ Estado: Usuario Estándar (No vinculado)\n\n`;
            msg += `👉 Para que el Administrador Maestro te otorgue privilegios de Operador Multicuenta (gestionar cuentas de diferentes funcionarios), entrégale este ID numérico:\n\n${chatId}`;
        }
        await sendTelegramMessage(chatId, msg);
        return;
    }

    // 0.1 Operator Funcionario Switch Command
    if (['/funcionario', '/funcionarios', '/cambiar', '/cambiar_funcionario', 'cambiar funcionario', 'cambiar funcionarios'].includes(text.toLowerCase().trim())) {
        const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
        if (!privilege) {
            await sendTelegramMessage(chatId, `ℹ️ La gestión de múltiples funcionarios está reservada para Operadores Autorizados con privilegios.\n\nEnvía /id para conocer tu Telegram ID y solicitar privilegios al Administrador Maestro.`);
            return;
        }
        await showOperatorFuncionarioMenu(chatId, privilege);
        return;
    }

    // 0.2 Operator Status Command
    if (text === '/operador' || text.toLowerCase() === 'operador' || text.toLowerCase() === 'modo operador') {
        const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
        if (!privilege) {
            await sendTelegramMessage(chatId, `ℹ️ No tienes un rol de operador asignado a este chat. Envía /id para ver tu ID.`);
            return;
        }
        const session = sessions.get(chatId);
        let msg = `🛡️ MODO OPERADOR MULTICUENTA\n\n`;
        msg += `🏷️ Operador: ${privilege.label}\n`;
        msg += `🌐 Alcance: ${privilege.scope === 'all' ? 'Todos los funcionarios (Acceso Global Maestro)' : `${privilege.assignedUsers?.length || 0} funcionarios asignados`}\n`;
        if (session && session.activeUserId) {
            const activeUser = await User.findById(session.activeUserId);
            const contract = session.activeContractId ? await Contract.findById(session.activeContractId) : null;
            msg += `👤 Funcionario en gestión: ${activeUser?.fullName || 'Desconocido'}\n`;
            if (contract) msg += `📋 Contrato: ${contract.contractNumber || 'En trámite'} (${contract.entityName || 'Alcaldía'})\n`;
        } else {
            msg += `👤 Funcionario en gestión: Ninguno seleccionado aún\n`;
        }
        msg += `\nPuedes presionar el botón abajo para cambiar de funcionario:`;
        await sendTelegramKeyboardMessage(chatId, msg, [
            [{ text: '👥 Seleccionar / Cambiar Funcionario', callback_data: 'operator_switch_user' }]
        ]);
        return;
    }

    // 1. Cancellation command
    if (text === '/cancelar' || text.toLowerCase() === 'cancelar' || text === '/cancel') {
        sessions.delete(chatId);
        await sendTelegramMessage(chatId, '❌ Operación cancelada. Sesión reiniciada.');
        return;
    }

    // 2. Active interactive states (highest priority: prevent greeting/trigger collision)
    if (session) {
        // Awaiting Payment Receipt
        if (session.state === 'awaiting_payment_receipt') {
            const media = extractTelegramFile(message);
            if (!media) {
                await sendTelegramKeyboardMessage(chatId, '📷 Por favor adjunta la fotografía, captura de pantalla o archivo PDF del comprobante de pago, o presiona Cancelar:', [
                    [{ text: '💳 Ver Medios de Pago', callback_data: 'view_payment_methods' }],
                    [{ text: '❌ Cancelar', callback_data: 'show_acts_menu' }]
                ]);
                return;
            }
            const activeUser = await resolveActiveUser(chatId);
            await handleIncomingPaymentReceipt(chatId, message, activeUser, media);
            return;
        }

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
                    fileInfo.description = caption || '';

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
                    } else if (fileInfo.mimetype && fileInfo.mimetype.startsWith('image/')) {
                        confirmMsg += `💡 *Tip sobre fotos:* Si envías varias fotos, puedes añadir un *pie de foto (caption)* a cada una para describirla individualmente en el informe.\n\n`;
                    }
                    confirmMsg += `👉 ¿Deseas subir más fotos o documentos a esta misma obligación? Puedes enviar otro archivo directamente o seleccionar una opción:`;

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

            const allContracts = await Contract.find().populate('user').sort({ createdAt: -1 });
            const userContracts = allContracts.filter(c => (c.idNumber || '').replace(/\D/g, '') === inputCedula);

            if (userContracts.length > 0) {
                let user = userContracts[0].user;
                if (!user || !user._id) {
                    user = await User.findById(userContracts[0].user) || await User.findOne();
                }
                if (user) {
                    user.telegramChatId = chatId;
                    user.telegramVerificationCode = null;
                    await user.save();
                }

                if (userContracts.length === 1) {
                    const contract = userContracts[0];
                    sessions.set(chatId, {
                        state: 'identified',
                        cedula: inputCedula,
                        activeContractId: contract._id,
                        contractId: contract._id,
                        userId: user ? user._id : null
                    });

                    const contractorName = contract.contractorName || (user ? user.fullName : 'Funcionario / Contratista');
                    let reply = `✅ ¡Identidad confirmada en el sistema!\n\n`;
                    reply += `👤 Funcionario: ${contractorName}\n`;
                    reply += `🪪 Cédula: ${contract.idNumber || inputCedula}\n`;
                    reply += `📋 Contrato: ${contract.contractNumber || 'En trámite'}\n`;
                    reply += `🏛️ Entidad: ${contract.entityName || contract.supervisorDependency || 'Alcaldía de Armenia'}\n\n`;
                    reply += `Tu usuario ha sido verificado con éxito en la base de datos.\n\n`;

                    if (!contract.activities || contract.activities.length === 0) {
                        reply += `⚠️ Aún no has cargado los documentos de tu contrato (Minuta, Acta de Inicio, RP, RUT, Certificación Bancaria).\n\n¿Deseas cargarlos ahora para extraer tus obligaciones y configurar tu cuenta?`;
                        sessions.set(chatId, {
                            state: 'awaiting_docs_consent',
                            userId: user ? user._id : null,
                            activeContractId: contract._id
                        });
                        await sendTelegramKeyboardMessage(chatId, reply, [
                            [{ text: '📄 Sí, cargar documentos', callback_data: 'start_docs_flow' }],
                            [{ text: '⏰ Más tarde', callback_data: 'skip_docs_flow' }]
                        ]);
                    } else {
                        reply += `¿Qué deseas gestionar para este contrato?`;

                        await sendTelegramKeyboardMessage(chatId, reply, [
                            [{ text: '📂 Subir Evidencia', callback_data: 'subir_evidencia' }],
                            [{ text: '🏥 Subir Planilla SS', callback_data: 'quick_upload_planilla' }],
                            [{ text: '📊 Resumen del Acta', callback_data: 'show_acts_menu' }],
                            [{ text: '📦 Descargar Paquete ZIP', callback_data: 'download_zip' }],
                            [{ text: '➕ Registrar Nuevo Contrato', callback_data: 'add_new_contract' }]
                        ]);
                    }
                } else {
                    // Multiple contracts registered for this person
                    sessions.set(chatId, {
                        state: 'identified',
                        cedula: inputCedula,
                        userId: user ? user._id : null
                    });

                    let reply = `✅ ¡Identidad confirmada en el sistema!\n\n`;
                    reply += `👤 Funcionario: ${user.fullName}\n`;
                    reply += `🪪 Cédula: ${inputCedula}\n\n`;
                    reply += `🏛️ Tienes ${userContracts.length} contratos registrados a tu nombre en el sistema.\n`;
                    reply += `Por favor selecciona con cuál contrato deseas trabajar hoy:`;

                    await sendTelegramMessage(chatId, reply);
                    await showContractSelectionMenu(chatId, user);
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
        // NEW CONTRACT REGISTRATION FLOW (Via Telegram Minuta upload)
        // -------------------------------------------------------------
        if (session.state === 'awaiting_new_contract_minuta') {
            const user = (session.userId ? await User.findById(session.userId) : null) || await User.findOne({ telegramChatId: chatId });
            if (!user) {
                sessions.delete(chatId);
                await sendTelegramMessage(chatId, '⚠️ Sesión no válida. Escribe "hola" para identificarte.');
                return;
            }

            if (text.toLowerCase() === 'cancelar' || text === '/cancelar') {
                sessions.set(chatId, { state: 'idle' });
                await sendTelegramMessage(chatId, '❌ Registro de nuevo contrato cancelado.');
                await showContractSelectionMenu(chatId, user);
                return;
            }

            const media = extractTelegramFile(message);
            if (!media) {
                await sendTelegramKeyboardMessage(chatId, '⚠️ Por favor adjunta el archivo PDF de la minuta de tu nuevo contrato, o presiona Cancelar:', [
                    [{ text: '❌ Cancelar', callback_data: 'switch_contract' }]
                ]);
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Descargando nuevo contrato y analizando con Inteligencia Artificial...');
            try {
                const fileInfo = await downloadTelegramMedia(media.fileId, 'minuta_nueva', media.originalName, media.mimeType);

                const existingContracts = await getUserContracts(user._id);
                const prev = existingContracts[0] || null;

                const newContract = new Contract({
                    user: user._id,
                    contractorName: user.fullName,
                    idNumber: prev?.idNumber || '',
                    contractorEmail: user.email,
                    contractorPhone: prev?.contractorPhone || '',
                    contractorAddress: prev?.contractorAddress || '',
                    bankName: prev?.bankName || '',
                    accountNumber: prev?.accountNumber || '',
                    paymentMethod: prev?.paymentMethod || 'Abono en cuenta',
                    isTaxFiler: prev ? prev.isTaxFiler : false,
                    baseDocumentPath: fileInfo.relativePath,
                    status: 'active'
                });

                try {
                    const extracted = await geminiService.extractContractData(fileInfo.absolutePath);
                    if (extracted) {
                        if (extracted.contractNumber) newContract.contractNumber = extracted.contractNumber;
                        if (extracted.contractType) newContract.contractType = extracted.contractType;
                        if (extracted.entityName) newContract.entityName = extracted.entityName;
                        if (extracted.supervisorDependency) newContract.supervisorDependency = extracted.supervisorDependency;
                        if (extracted.contractorName && !newContract.contractorName) newContract.contractorName = extracted.contractorName;
                        if (extracted.idNumber && !newContract.idNumber) newContract.idNumber = extracted.idNumber;
                        if (extracted.startDate) newContract.startDate = extracted.startDate;
                        if (extracted.endDate) newContract.endDate = extracted.endDate;
                        if (extracted.executionTerm) newContract.executionTerm = extracted.executionTerm;
                        if (extracted.periodType) newContract.periodType = extracted.periodType;
                        if (extracted.initialDurationMonths) newContract.initialDurationMonths = Number(extracted.initialDurationMonths);
                        if (extracted.cdp) newContract.cdp = extracted.cdp;
                        if (extracted.rp) newContract.rp = extracted.rp;
                        if (extracted.rubro) newContract.rubro = extracted.rubro;
                        if (extracted.totalValue) newContract.totalValue = String(extracted.totalValue);
                        if (extracted.totalValueWord) newContract.totalValueWord = extracted.totalValueWord;
                        if (extracted.monthlyValue) newContract.monthlyValue = String(extracted.monthlyValue);
                        if (extracted.monthlyValueWord) newContract.monthlyValueWord = extracted.monthlyValueWord;
                        if (extracted.bankName) newContract.bankName = extracted.bankName;
                        if (extracted.accountNumber) newContract.accountNumber = extracted.accountNumber;
                        if (extracted.paymentMethod) newContract.paymentMethod = extracted.paymentMethod;
                        if (extracted.contractObject) newContract.contractObject = extracted.contractObject;
                        if (extracted.supervisorName) newContract.supervisorName = extracted.supervisorName;
                        if (extracted.contractorAddress) newContract.contractorAddress = extracted.contractorAddress;
                        if (extracted.cutoffDay) newContract.cutoffDay = Number(extracted.cutoffDay);
                        if (extracted.activities && Array.isArray(extracted.activities) && extracted.activities.length > 0) {
                            newContract.activities = extracted.activities;
                        }
                    }
                } catch (aiErr) {
                    console.error('Error extrayendo datos de nueva minuta con IA:', aiErr.message);
                }

                await newContract.save();

                sessions.set(chatId, {
                    state: 'idle',
                    activeContractId: newContract._id,
                    contractId: newContract._id,
                    userId: user._id
                });

                const oblCount = newContract.activities ? newContract.activities.length : 0;
                let reply = `🎉 ¡Nuevo contrato registrado exitosamente!\n\n`;
                reply += `📌 Contrato N°: ${newContract.contractNumber || 'En trámite'}\n`;
                reply += `🏛️ Entidad: ${newContract.entityName || newContract.supervisorDependency || 'Alcaldía'}\n`;
                reply += `👤 Supervisor: ${newContract.supervisorName || 'No asignado'}\n`;
                reply += `⏱️ Plazo: ${getContractDurationText(newContract)}\n`;
                reply += `📝 Obligaciones identificadas: ${oblCount}\n\n`;
                reply += `Este contrato ha sido configurado como tu contrato activo actual. Todas las evidencias y actas que gestiones ahora pertenecerán exclusivamente a este contrato.`;

                await sendTelegramKeyboardMessage(chatId, reply, [
                    [{ text: '📂 Subir Evidencias de este Contrato', callback_data: 'subir_evidencia' }],
                    [{ text: '📄 Cargar Documentos (RP, Acta Inicio, etc.)', callback_data: 'start_docs_flow' }],
                    [{ text: '🔄 Cambiar de Contrato', callback_data: 'switch_contract' }]
                ]);
            } catch (err) {
                console.error('Error al registrar nuevo contrato:', err);
                await sendTelegramMessage(chatId, `❌ Error al procesar el archivo: ${err.message}`);
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
                let contract = (session.activeContractId || session.contractId)
                    ? await Contract.findById(session.activeContractId || session.contractId)
                    : await Contract.findOne({ user: user._id }).sort({ createdAt: -1 });
                if (!contract) contract = new Contract({ user: user._id });
                contract.baseDocumentPath = fileInfo.relativePath;

                try {
                    const extracted = await geminiService.extractContractData(fileInfo.absolutePath);
                    if (extracted) {
                        if (extracted.contractNumber) contract.contractNumber = extracted.contractNumber;
                        if (extracted.contractType) contract.contractType = extracted.contractType;
                        if (extracted.entityName) contract.entityName = extracted.entityName;
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
                    session.activeContractId = contract._id;
                    session.contractId = contract._id;
                    sessions.set(chatId, session);

                    const oblCount = contract.activities ? contract.activities.length : 0;
                    await sendTelegramMessage(chatId, `✅ Minuta procesada con éxito.\n📋 Contrato N°: ${contract.contractNumber || 'Registrado'}\n🏛️ Entidad: ${contract.entityName || 'Alcaldía'}\n📝 Obligaciones identificadas: ${oblCount}`);
                } catch (aiErr) {
                    console.error('Error de IA en Minuta:', aiErr);
                    await contract.save();
                    session.activeContractId = contract._id;
                    session.contractId = contract._id;
                    sessions.set(chatId, session);
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
                let contract = (session.activeContractId || session.contractId)
                    ? await Contract.findById(session.activeContractId || session.contractId)
                    : await Contract.findOne({ user: user._id }).sort({ createdAt: -1 });
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
                let contract = (session.activeContractId || session.contractId)
                    ? await Contract.findById(session.activeContractId || session.contractId)
                    : await Contract.findOne({ user: user._id }).sort({ createdAt: -1 });
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
                let contract = (session.activeContractId || session.contractId)
                    ? await Contract.findById(session.activeContractId || session.contractId)
                    : await Contract.findOne({ user: user._id }).sort({ createdAt: -1 });
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
                            session.state = 'awaiting_doc_rut_password';
                            session.pendingFilePath = fileInfo.absolutePath;
                            session.pendingContractId = contract?._id;
                            sessions.set(chatId, session);
                            await sendTelegramKeyboardMessage(chatId, `🔐 *RUT Protegido con Contraseña*\n\nTu RUT tiene clave e intentamos abrirlo automáticamente con tu número de cédula (*${contract?.idNumber || 'No registrada'}*), pero no coincidió.\n\n👉 *Por favor escribe y envía la contraseña de tu RUT aquí por este chat:*`, [
                                [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_rut' }]
                            ]);
                            return;
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

        // Doc Step 4.1: Contraseña del RUT
        if (session.state === 'awaiting_doc_rut_password') {
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

            const passwordEntered = text.trim();
            if (!passwordEntered) {
                await sendTelegramMessage(chatId, '⚠️ Por favor escribe la contraseña del RUT o presiona saltar:');
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Desbloqueando RUT y analizando con IA...');
            try {
                const extracted = await geminiService.extractRutData(session.pendingFilePath, {
                    password: passwordEntered,
                    candidatePasswords: []
                });

                let contract = session.pendingContractId
                    ? await Contract.findById(session.pendingContractId)
                    : await Contract.findOne({ user: user._id }).sort({ createdAt: -1 });

                if (contract && extracted) {
                    if (extracted.contractorAddress) contract.contractorAddress = extracted.contractorAddress;
                    if (extracted.idCity) contract.idCity = extracted.idCity;
                    if (typeof extracted.isTaxFiler === 'boolean') contract.isTaxFiler = extracted.isTaxFiler;
                    if (extracted.contractorPhone && !contract.contractorPhone) contract.contractorPhone = extracted.contractorPhone;
                    if (extracted.contractorEmail && !contract.contractorEmail) contract.contractorEmail = extracted.contractorEmail;
                    await contract.save();
                }

                await sendTelegramMessage(chatId, `✅ ¡RUT desbloqueado y procesado con éxito con tu contraseña!\n📍 Dirección: ${contract?.contractorAddress || 'N/A'} (${contract?.idCity || ''})\n💼 Declarante de Renta: ${contract?.isTaxFiler ? 'Sí' : 'No'}`);
                await promptBank(chatId, user);
                return;
            } catch (passErr) {
                if (passErr.code === 'PASSWORD_REQUIRED') {
                    await sendTelegramKeyboardMessage(chatId, '❌ La contraseña ingresada no es correcta para el RUT. Por favor escríbela nuevamente o presiona saltar:', [
                        [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_rut' }]
                    ]);
                    return;
                }
                await sendTelegramMessage(chatId, `⚠️ Error al procesar RUT: ${passErr.message}`);
                await promptBank(chatId, user);
                return;
            }
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
                let contract = (session.activeContractId || session.contractId)
                    ? await Contract.findById(session.activeContractId || session.contractId)
                    : await Contract.findOne({ user: user._id }).sort({ createdAt: -1 });
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
                            session.state = 'awaiting_doc_bank_password';
                            session.pendingFilePath = fileInfo.absolutePath;
                            session.pendingContractId = contract?._id;
                            sessions.set(chatId, session);
                            await sendTelegramKeyboardMessage(chatId, `🔐 *Certificado Bancario Protegido con Contraseña*\n\nTu certificado bancario tiene clave e intentamos abrirlo automáticamente con tu número de cédula (*${contract?.idNumber || 'No registrada'}*), pero no coincidió.\n\n👉 *Por favor escribe y envía la contraseña de tu certificación bancaria aquí por este chat:*`, [
                                [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_bank' }]
                            ]);
                            return;
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

        // Doc Step 5.1: Contraseña del Certificado Bancario
        if (session.state === 'awaiting_doc_bank_password') {
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

            const passwordEntered = text.trim();
            if (!passwordEntered) {
                await sendTelegramMessage(chatId, '⚠️ Por favor escribe la contraseña del certificado o presiona saltar:');
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Desbloqueando certificación bancaria y analizando con IA...');
            try {
                const extracted = await geminiService.extractBankCertificateData(session.pendingFilePath, {
                    password: passwordEntered,
                    candidatePasswords: []
                });

                let contract = session.pendingContractId
                    ? await Contract.findById(session.pendingContractId)
                    : await Contract.findOne({ user: user._id }).sort({ createdAt: -1 });

                if (contract && extracted) {
                    if (extracted.bankName) contract.bankName = extracted.bankName;
                    if (extracted.accountNumber) contract.accountNumber = extracted.accountNumber;
                    if (extracted.paymentMethod) contract.paymentMethod = extracted.paymentMethod;
                    await contract.save();
                }

                await sendTelegramMessage(chatId, `✅ ¡Certificación Bancaria desbloqueada y procesada con éxito con tu contraseña!\n🏦 Banco: ${contract?.bankName || 'N/A'}\n💳 Cuenta: ${contract?.paymentMethod || 'Ahorros'} N° ${contract?.accountNumber || 'N/A'}`);
                await promptSecuritySocial(chatId, user);
                return;
            } catch (passErr) {
                if (passErr.code === 'PASSWORD_REQUIRED') {
                    await sendTelegramKeyboardMessage(chatId, '❌ La contraseña ingresada no es correcta para el certificado. Por favor escríbela nuevamente o presiona saltar:', [
                        [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_bank' }]
                    ]);
                    return;
                }
                await sendTelegramMessage(chatId, `⚠️ Error al procesar certificado: ${passErr.message}`);
                await promptSecuritySocial(chatId, user);
                return;
            }
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
                let contract = (session.activeContractId || session.contractId)
                    ? await Contract.findById(session.activeContractId || session.contractId)
                    : await Contract.findOne({ user: user._id }).sort({ createdAt: -1 });
                if (contract) {
                    contract.securitySocialPath = fileInfo.relativePath;
                    await contract.save();
                }

                // Also update the latest / pending billing period if exists for this contract
                const billingPeriod = await BillingPeriod.findOne({
                    user: user._id,
                    $or: [{ contract: contract ? contract._id : null }, { contract: null }]
                }).sort({ createdAt: -1 });

                const candidates = [];
                if (contract && contract.idNumber) {
                    candidates.push(contract.idNumber.trim());
                    const clean = contract.idNumber.replace(/\D/g, '');
                    if (clean && clean !== contract.idNumber.trim()) candidates.push(clean);
                }

                try {
                    const extracted = await geminiService.extractSecuritySocialData(fileInfo.absolutePath, {
                        candidatePasswords: candidates
                    });
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

                        const note = extracted?.unlockedWithCedula ? ' (desbloqueada automáticamente con tu cédula)' : '';
                        let ssMsg = `✅ Planilla de Seguridad Social procesada con éxito${note}.\n`;
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
                    if (aiErr.code === 'PASSWORD_REQUIRED') {
                        session.state = 'awaiting_doc_planilla_password';
                        session.pendingFilePath = fileInfo.absolutePath;
                        session.pendingContractId = contract?._id;
                        session.pendingBillingPeriodId = billingPeriod?._id;
                        sessions.set(chatId, session);
                        await sendTelegramKeyboardMessage(chatId, `🔐 *Planilla de Seguridad Social Protegida con Contraseña*\n\nTu planilla tiene clave e intentamos abrirla automáticamente con tu número de cédula (*${contract?.idNumber || 'No registrada'}*), pero no coincidió.\n\n👉 *Por favor escribe y envía la contraseña de tu planilla aquí por este chat:*`, [
                            [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_planilla' }]
                        ]);
                        return;
                    } else {
                        await sendTelegramMessage(chatId, `⚠️ Se guardó el archivo de la Planilla, pero no se pudieron extraer todos los datos automáticamente (${aiErr.message}).`);
                    }
                }
            } catch (err) {
                console.error('Error al procesar Planilla SS:', err);
                await sendTelegramMessage(chatId, `❌ Error al procesar archivo: ${err.message}`);
            }
            await finishDocsFlow(chatId, user);
            return;
        }

        // Doc Step 6.1: Contraseña de la Planilla de Seguridad Social
        if (session.state === 'awaiting_doc_planilla_password') {
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

            const passwordEntered = text.trim();
            if (!passwordEntered) {
                await sendTelegramMessage(chatId, '⚠️ Por favor escribe la contraseña de la planilla o presiona saltar:');
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Desbloqueando Planilla de Seguridad Social y analizando con IA...');
            try {
                const extracted = await geminiService.extractSecuritySocialData(session.pendingFilePath, {
                    password: passwordEntered,
                    candidatePasswords: []
                });

                let contract = session.pendingContractId
                    ? await Contract.findById(session.pendingContractId)
                    : await Contract.findOne({ user: user._id }).sort({ createdAt: -1 });

                let billingPeriod = session.pendingBillingPeriodId
                    ? await BillingPeriod.findById(session.pendingBillingPeriodId)
                    : await BillingPeriod.findOne({
                        user: user._id,
                        $or: [{ contract: contract ? contract._id : null }, { contract: null }]
                    }).sort({ createdAt: -1 });

                if (extracted && billingPeriod) {
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

                let ssMsg = `✅ ¡Planilla de Seguridad Social desbloqueada y procesada con éxito con tu contraseña!\n`;
                if (extracted?.operator) ssMsg += `🏢 Operador: ${extracted.operator}\n`;
                if (extracted?.planillaNumber) ssMsg += `🔢 N° Planilla: ${extracted.planillaNumber}\n`;
                if (extracted?.period) ssMsg += `📅 Periodo: ${extracted.period}\n`;
                if (extracted?.totalPaid) {
                    ssMsg += `💰 Total Pagado: $${Number(extracted.totalPaid).toLocaleString('es-CO')}\n`;
                    if (extracted.saludPaid) ssMsg += `  • Salud: $${Number(extracted.saludPaid).toLocaleString('es-CO')}\n`;
                    if (extracted.pensionPaid) ssMsg += `  • Pensión: $${Number(extracted.pensionPaid).toLocaleString('es-CO')}\n`;
                    if (extracted.arlPaid) ssMsg += `  • ARL: $${Number(extracted.arlPaid).toLocaleString('es-CO')}\n`;
                }
                await sendTelegramMessage(chatId, ssMsg);
                await finishDocsFlow(chatId, user);
                return;
            } catch (passErr) {
                if (passErr.code === 'PASSWORD_REQUIRED') {
                    await sendTelegramKeyboardMessage(chatId, '❌ La contraseña ingresada no es correcta para la planilla. Por favor escríbela nuevamente o presiona saltar:', [
                        [{ text: '⏩ Saltar este documento', callback_data: 'skip_doc_planilla' }]
                    ]);
                    return;
                }
                await sendTelegramMessage(chatId, `⚠️ Error al procesar planilla: ${passErr.message}`);
                await finishDocsFlow(chatId, user);
                return;
            }
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
                let refContract = null;
                if (period.contract) {
                    refContract = await Contract.findByIdAndUpdate(period.contract, { securitySocialPath: fileInfo.relativePath }, { new: true });
                } else {
                    refContract = await Contract.findOneAndUpdate({ user: user._id }, { securitySocialPath: fileInfo.relativePath }, { new: true });
                }

                const candidates = [];
                if (refContract && refContract.idNumber) {
                    candidates.push(refContract.idNumber.trim());
                    const clean = refContract.idNumber.replace(/\D/g, '');
                    if (clean && clean !== refContract.idNumber.trim()) candidates.push(clean);
                }

                try {
                    const extracted = await geminiService.extractSecuritySocialData(fileInfo.absolutePath, {
                        candidatePasswords: candidates
                    });
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

                        const note = extracted?.unlockedWithCedula ? ' (desbloqueada automáticamente con tu cédula)' : '';
                        let ssMsg = `✅ ¡Planilla de Seguridad Social guardada y vinculada al Acta N° ${period.actNumber}!${note}\n\n`;
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
                    if (aiErr.code === 'PASSWORD_REQUIRED') {
                        session.state = 'awaiting_period_planilla_password';
                        session.pendingFilePath = fileInfo.absolutePath;
                        session.periodId = period._id;
                        session.refContractId = refContract?._id;
                        sessions.set(chatId, session);
                        await sendTelegramKeyboardMessage(chatId, `🔐 *Planilla de Seguridad Social Protegida con Contraseña*\n\nTu planilla tiene clave e intentamos abrirla automáticamente con tu número de cédula (*${refContract?.idNumber || 'No registrada'}*), pero no coincidió.\n\n👉 *Por favor escribe y envía la contraseña de tu planilla de seguridad social aquí por este chat:*`, [
                            [{ text: '❌ Cancelar', callback_data: `summary_${period._id}` }]
                        ]);
                        return;
                    } else {
                        await sendTelegramMessage(chatId, `⚠️ Se guardó el archivo de la Planilla en el Acta N° ${period.actNumber}, pero no se pudieron extraer todos los datos automáticamente (${aiErr.message}).`);
                    }
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

        // Upload Planilla Password for a specific BillingPeriod (Acta)
        if (session.state === 'awaiting_period_planilla_password') {
            const user = (session.userId ? await User.findById(session.userId) : null) || await User.findOne({ telegramChatId: chatId });
            if (!user) {
                sessions.delete(chatId);
                await sendTelegramMessage(chatId, '⚠️ Sesión no válida. Escribe "hola" para identificarte.');
                return;
            }

            const periodId = session.periodId;
            if (isNegative(text) || text.toLowerCase() === 'cancelar') {
                sessions.set(chatId, { state: 'idle' });
                await sendTelegramMessage(chatId, '❌ Desbloqueo de planilla cancelado.');
                if (periodId) await showPeriodSummary(chatId, periodId);
                return;
            }

            const passwordEntered = text.trim();
            if (!passwordEntered) {
                await sendTelegramMessage(chatId, '⚠️ Por favor escribe la contraseña de la planilla o presiona Cancelar:');
                return;
            }

            await sendTelegramMessage(chatId, '⏳ Desbloqueando planilla de seguridad social y analizando con Inteligencia Artificial...');
            try {
                const extracted = await geminiService.extractSecuritySocialData(session.pendingFilePath, {
                    password: passwordEntered,
                    candidatePasswords: []
                });

                const period = await BillingPeriod.findById(periodId);
                if (!period) {
                    sessions.set(chatId, { state: 'idle' });
                    await sendTelegramMessage(chatId, '⚠️ No se encontró el periodo del acta.');
                    return;
                }

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

                    let ssMsg = `✅ ¡Planilla de Seguridad Social desbloqueada y vinculada al Acta N° ${period.actNumber} con tu contraseña!\n\n`;
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

                sessions.set(chatId, { state: 'idle' });
                await showPeriodSummary(chatId, period._id);
                return;
            } catch (passErr) {
                if (passErr.code === 'PASSWORD_REQUIRED') {
                    await sendTelegramKeyboardMessage(chatId, '❌ La contraseña ingresada no es correcta para la planilla. Por favor escríbela nuevamente o presiona Cancelar:', [
                        [{ text: '❌ Cancelar', callback_data: `summary_${periodId}` }]
                    ]);
                    return;
                }
                await sendTelegramMessage(chatId, `⚠️ Error al procesar planilla: ${passErr.message}`);
                sessions.set(chatId, { state: 'idle' });
                if (periodId) await showPeriodSummary(chatId, periodId);
                return;
            }
        }
    }

    // 3. Greeting Detection: "hola", "buen dia", "/start", etc.
    if (isGreeting(text)) {
        const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
        if (privilege) {
            privilege.lastActiveAt = new Date();
            await privilege.save();

            const session = sessions.get(chatId);
            if (session && session.activeUserId) {
                const activeUser = await User.findById(session.activeUserId);
                if (activeUser) {
                    const contract = session.activeContractId ? await Contract.findById(session.activeContractId) : await Contract.findOne({ user: activeUser._id }).sort({ createdAt: -1 });
                    let reply = `🛡️ MODO OPERADOR: ${privilege.label}\n`;
                    reply += `━━━━━━━━━━━━━━━━━━━━\n`;
                    reply += `👤 FUNCIONARIO ACTIVO: ${activeUser.fullName}\n`;
                    reply += `🪪 Cédula: ${contract?.idNumber || 'Sin cédula'}\n`;
                    reply += `📋 Contrato: ${contract?.contractNumber || 'En trámite'}\n`;
                    reply += `🏛️ Entidad: ${contract?.entityName || contract?.supervisorDependency || 'Alcaldía de Armenia'}\n`;
                    reply += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                    reply += `¿Qué deseas gestionar para ${activeUser.fullName}?`;

                    await sendTelegramKeyboardMessage(chatId, reply, [
                        [{ text: '📂 Subir Evidencias', callback_data: 'subir_evidencia' }],
                        [{ text: '🏥 Subir Planilla SS', callback_data: 'quick_upload_planilla' }],
                        [{ text: '📊 Resumen del Acta', callback_data: 'show_acts_menu' }],
                        [{ text: '📦 Descargar Paquete ZIP', callback_data: 'download_zip' }],
                        [{ text: '👥 Cambiar de Funcionario', callback_data: 'operator_switch_user' }]
                    ]);
                    return;
                }
            }

            await showOperatorFuncionarioMenu(chatId, privilege);
            return;
        }

        sessions.set(chatId, { state: 'awaiting_identification' });
        await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
        return;
    }

    // 3.5. Contracts trigger: "contratos", "mis contratos", "cambiar contrato", "/contratos"
    if (isContratosCommand(text)) {
        const user = await resolveActiveUser(chatId);
        if (!user) {
            const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
            if (privilege) {
                await showOperatorFuncionarioMenu(chatId, privilege);
                return;
            }
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }
        await showContractSelectionMenu(chatId, user);
        return;
    }

    // 4. Planilla trigger: "planilla", "subir planilla", "seguridad social", etc.
    if (isPlanilla(text)) {
        const user = await resolveActiveUser(chatId);
        if (!user) {
            const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
            if (privilege) {
                await showOperatorFuncionarioMenu(chatId, privilege);
                return;
            }
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }

        const contract = await resolveActiveContract(chatId, user);
        const query = { user: user._id };
        if (contract) query.contract = contract._id;
        const billingPeriod = await BillingPeriod.findOne(query).sort({ createdAt: -1 });
        if (!billingPeriod) {
            await promptSecuritySocial(chatId, user);
            return;
        }

        await promptPeriodPlanilla(chatId, billingPeriod._id);
        return;
    }

    // 5. "Subir Evidencia" trigger: "subir evidencia", "si", "si deseo cargar evidencia", etc.
    if (isSubirEvidencia(text)) {
        const user = await resolveActiveUser(chatId);
        if (!user) {
            const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
            if (privilege) {
                await showOperatorFuncionarioMenu(chatId, privilege);
                return;
            }
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
        const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });

        const allContracts = await Contract.find().populate('user').sort({ createdAt: -1 });
        const userContracts = allContracts.filter(c => (c.idNumber || '').replace(/\D/g, '') === numericOnly);

        if (userContracts.length > 0) {
            let user = userContracts[0].user;
            if (!user || !user._id) {
                user = await User.findById(userContracts[0].user) || await User.findOne();
            }

            if (privilege) {
                // If operator, verify scope
                if (privilege.scope === 'specific') {
                    const isAssigned = (privilege.assignedUsers || []).some(id => id.toString() === user._id.toString());
                    if (!isAssigned) {
                        await sendTelegramMessage(chatId, `⚠️ No tienes permisos asignados para gestionar al funcionario con cédula ${numericOnly} ("${user.fullName}"). Solicita al Administrador Maestro que te lo asigne desde el panel web.`);
                        return;
                    }
                }
                await selectOperatorUser(chatId, privilege, user._id);
                return;
            }

            if (user) {
                user.telegramChatId = chatId;
                user.telegramVerificationCode = null;
                await user.save();
            }

            if (userContracts.length === 1) {
                const contract = userContracts[0];
                sessions.set(chatId, {
                    state: 'identified',
                    cedula: numericOnly,
                    activeContractId: contract._id,
                    contractId: contract._id,
                    userId: user ? user._id : null
                });

                const contractorName = contract.contractorName || (user ? user.fullName : 'Funcionario / Contratista');
                let reply = `✅ ¡Identidad confirmada en el sistema!\n\n`;
                reply += `👤 Funcionario: ${contractorName}\n`;
                reply += `🪪 Cédula: ${contract.idNumber || numericOnly}\n`;
                reply += `📋 Contrato: ${contract.contractNumber || 'En trámite'}\n`;
                reply += `🏛️ Entidad: ${contract.entityName || contract.supervisorDependency || 'Alcaldía de Armenia'}\n\n`;
                reply += `Tu usuario ha sido verificado con éxito en la base de datos.\n\n`;

                if (!contract.activities || contract.activities.length === 0) {
                    reply += `⚠️ Aún no has cargado los documentos de tu contrato (Minuta, Acta de Inicio, RP, RUT, Certificación Bancaria, Planilla de Seguridad Social).\n\n¿Deseas cargarlos ahora para extraer tus obligaciones y configurar tu cuenta?`;
                    sessions.set(chatId, {
                        state: 'awaiting_docs_consent',
                        userId: user ? user._id : null,
                        activeContractId: contract._id
                    });
                    await sendTelegramKeyboardMessage(chatId, reply, [
                        [{ text: '📄 Sí, cargar documentos', callback_data: 'start_docs_flow' }],
                        [{ text: '⏰ Más tarde', callback_data: 'skip_docs_flow' }]
                    ]);
                } else {
                    const { targetAct, currentPeriod } = await getContractCurrentActiveAct(user._id, contract._id, contract);
                    const access = await checkPeriodAccess(chatId, user, targetAct, currentPeriod);

                    if (!access.allowed) {
                        sessions.set(chatId, {
                            state: 'awaiting_payment_receipt',
                            cedula: numericOnly,
                            activeContractId: contract._id,
                            contractId: contract._id,
                            userId: user ? user._id : null,
                            awaitingPaymentForAct: targetAct,
                            paymentType: access.paymentType || 'individual'
                        });

                        const paymentButtons = [
                            [{ text: `📷 Adjuntar Comprobante ($${Number(access.amount || 60000).toLocaleString('es-CO')})`, callback_data: access.paymentType === 'package' ? 'pay_package' : `pay_act_${targetAct}` }],
                            [{ text: '💳 Ver Medios de Pago', callback_data: 'view_payment_methods' }]
                        ];
                        if (access.paymentType !== 'package') {
                            paymentButtons.push([{ text: '📦 Comprar Paquete (5 Cuentas x $100.000)', callback_data: 'buy_package' }]);
                        }
                        paymentButtons.push([{ text: '📊 Resumen de Actas', callback_data: 'show_acts_menu' }]);

                        await sendTelegramKeyboardMessage(chatId, `${reply}${access.message}`, paymentButtons);
                        return;
                    }

                    reply += `¿Qué deseas realizar hoy?`;

                    await sendTelegramKeyboardMessage(chatId, reply, [
                        [{ text: '📂 Subir Evidencia', callback_data: 'subir_evidencia' }],
                        [{ text: '🏥 Subir Planilla SS', callback_data: 'quick_upload_planilla' }],
                        [{ text: '📊 Resumen del Acta', callback_data: 'show_acts_menu' }],
                        [{ text: '📦 Descargar Paquete ZIP', callback_data: 'download_zip' }],
                        [{ text: '➕ Registrar Nuevo Contrato', callback_data: 'add_new_contract' }]
                    ]);
                }
                return;
            } else {
                // Multiple contracts registered for this person
                sessions.set(chatId, {
                    state: 'identified',
                    cedula: numericOnly,
                    userId: user ? user._id : null
                });

                let reply = `✅ ¡Identidad confirmada en el sistema!\n\n`;
                reply += `👤 Funcionario: ${user.fullName}\n`;
                reply += `🪪 Cédula: ${numericOnly}\n\n`;
                reply += `🏛️ Tienes ${userContracts.length} contratos registrados a tu nombre en el sistema.\n`;
                reply += `Por favor selecciona con cuál contrato deseas trabajar hoy:`;

                await sendTelegramMessage(chatId, reply);
                await showContractSelectionMenu(chatId, user);
                return;
            }
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

                const userContracts = await getUserContracts(user._id);

                if (userContracts.length > 1) {
                    sessions.set(chatId, {
                        state: 'identified',
                        userId: user._id,
                        cedula: userContracts[0]?.idNumber || ''
                    });

                    let reply = `✅ ¡Cuenta vinculada exitosamente!\n\n`;
                    reply += `👋 Hola ${user.fullName}, tu cuenta de Telegram ha quedado conectada con éxito.\n\n`;
                    reply += `🏛️ Tienes ${userContracts.length} contratos registrados a tu nombre. Por favor selecciona el contrato con el que deseas trabajar:`;

                    await sendTelegramMessage(chatId, reply);
                    await showContractSelectionMenu(chatId, user);
                } else if (userContracts.length === 1) {
                    const contract = userContracts[0];
                    sessions.set(chatId, {
                        state: 'identified',
                        userId: user._id,
                        activeContractId: contract._id,
                        contractId: contract._id,
                        cedula: contract?.idNumber || ''
                    });

                    let reply = `✅ ¡Cuenta vinculada exitosamente!\n\n`;
                    reply += `👋 Hola ${user.fullName}, tu cuenta de Telegram ha quedado conectada con éxito a tu usuario en el sistema.\n\n`;

                    if (!contract.activities || contract.activities.length === 0) {
                        reply += `⚠️ Tu contrato está registrado pero aún no tiene obligaciones específicas cargadas.\n\nPuedes cargar tu minuta en PDF para extraerlas.`;
                        await sendTelegramMessage(chatId, reply);
                    } else {
                        reply += `¿Qué deseas realizar hoy?`;
                        await sendTelegramKeyboardMessage(chatId, reply, [
                            [{ text: '📂 Subir Evidencia', callback_data: 'subir_evidencia' }],
                            [{ text: '🏥 Subir Planilla SS', callback_data: 'quick_upload_planilla' }],
                            [{ text: '📊 Resumen del Acta', callback_data: 'show_acts_menu' }],
                            [{ text: '📦 Descargar Paquete ZIP', callback_data: 'download_zip' }],
                            [{ text: '➕ Registrar Nuevo Contrato', callback_data: 'add_new_contract' }]
                        ]);
                    }
                } else {
                    let reply = `✅ ¡Cuenta vinculada exitosamente!\n\n`;
                    reply += `👋 Hola ${user.fullName}, tu cuenta de Telegram ha quedado conectada con éxito a tu usuario en el sistema.\n\n`;
                    reply += `ℹ️ Nota: Aún no has configurado tu contrato base en el sistema.\n`;
                    reply += `Puedes presionar el botón abajo para registrar tu primer contrato cargando la minuta:`;
                    await sendTelegramKeyboardMessage(chatId, reply, [
                        [{ text: '➕ Registrar Nuevo Contrato', callback_data: 'add_new_contract' }]
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
        const user = await resolveActiveUser(chatId);
        if (!user) {
            const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
            if (privilege) {
                await showOperatorFuncionarioMenu(chatId, privilege);
                return;
            }
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
        const user = await resolveActiveUser(chatId);
        if (!user) {
            const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
            if (privilege) {
                await showOperatorFuncionarioMenu(chatId, privilege);
                return;
            }
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }

        const contract = await resolveActiveContract(chatId, user);
        const query = { user: user._id };
        if (contract) query.contract = contract._id;
        const billingPeriod = await BillingPeriod.findOne(query).sort({ createdAt: -1 });

        if (!billingPeriod) {
            await sendTelegramMessage(chatId, '📭 Aún no tienes periodos registrados en el sistema para este contrato.');
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
        const user = await resolveActiveUser(chatId);
        if (!user) {
            const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
            if (privilege) {
                await showOperatorFuncionarioMenu(chatId, privilege);
                return;
            }
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }

        const contract = await resolveActiveContract(chatId, user);
        const query = { user: user._id };
        if (contract) query.contract = contract._id;
        const billingPeriod = await BillingPeriod.findOne(query).sort({ createdAt: -1 });
        if (!billingPeriod) {
            await sendTelegramMessage(chatId, '📭 Aún no tienes periodos registrados en el sistema para este contrato.');
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
        const user = await resolveActiveUser(chatId);
        if (!user) {
            const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
            if (privilege) {
                await showOperatorFuncionarioMenu(chatId, privilege);
                return;
            }
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }

        const contract = await resolveActiveContract(chatId, user);
        const query = { user: user._id };
        if (contract) query.contract = contract._id;
        const billingPeriod = await BillingPeriod.findOne(query).sort({ createdAt: -1 });
        if (billingPeriod) {
            await showPeriodSummary(chatId, billingPeriod._id);
        } else {
            await showActsMenu(chatId, user);
        }
        return;
    } else if (text === '/planilla' || text.toLowerCase() === 'planilla' || text.toLowerCase() === 'subir planilla' || text.toLowerCase() === 'cargar planilla') {
        const user = await resolveActiveUser(chatId);
        if (!user) {
            const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
            if (privilege) {
                await showOperatorFuncionarioMenu(chatId, privilege);
                return;
            }
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }

        const contract = await resolveActiveContract(chatId, user);
        const query = { user: user._id };
        if (contract) query.contract = contract._id;
        const billingPeriod = await BillingPeriod.findOne(query).sort({ createdAt: -1 });
        if (!billingPeriod) {
            await promptSecuritySocial(chatId, user);
            return;
        }

        await promptPeriodPlanilla(chatId, billingPeriod._id);
        return;
    } else if (text === '/documentos' || text.toLowerCase() === 'documentos' || text.toLowerCase() === 'cargar documentos' || text.toLowerCase() === 'subir documentos') {
        const user = await resolveActiveUser(chatId);
        if (!user) {
            const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
            if (privilege) {
                await showOperatorFuncionarioMenu(chatId, privilege);
                return;
            }
            sessions.set(chatId, { state: 'awaiting_identification' });
            await sendTelegramMessage(chatId, 'bienvenido al sistema de generacion de cuentas, enviame tu numero de documento de identidad sin puntos, solo numeros porfa');
            return;
        }
        await startContractDocsFlow(chatId, user);
        return;
    } else {
        const user = await resolveActiveUser(chatId);
        if (user) {
            const media = extractTelegramFile(message);
            const caption = (message.caption || '').toLowerCase();
            const fileName = (message.document?.file_name || '').toLowerCase();
            const isPlanillaFile = caption.includes('planilla') || caption.includes('seguridad social') || caption.includes('pila') ||
                                   fileName.includes('planilla') || fileName.includes('seguridad') || fileName.includes('pila') || fileName.includes('aporte');

            if (media && isPlanillaFile) {
                const contract = await resolveActiveContract(chatId, user);
                const query = { user: user._id };
                if (contract) query.contract = contract._id;
                const billingPeriod = await BillingPeriod.findOne(query).sort({ createdAt: -1 });
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

            // Check if media is a payment receipt or user has an act pending payment
            if (media) {
                const isPaymentKeyword = caption.includes('pago') || caption.includes('comprobante') || caption.includes('recibo') ||
                                         caption.includes('transferencia') || caption.includes('consigna') || caption.includes('soporte') ||
                                         caption.includes('nequi') || caption.includes('daviplata') || caption.includes('bancolombia') ||
                                         fileName.includes('pago') || fileName.includes('comprobante') || fileName.includes('recibo') ||
                                         fileName.includes('transferencia') || fileName.includes('consigna') || fileName.includes('soporte');

                const contract = await resolveActiveContract(chatId, user);
                let actRequiresPayment = false;
                let currentAct = 2;
                if (contract) {
                    const { targetAct, currentPeriod } = await getContractCurrentActiveAct(user._id, contract._id, contract);
                    currentAct = targetAct;
                    const access = await checkPeriodAccess(chatId, user, targetAct, currentPeriod);
                    if (!access.allowed) {
                        actRequiresPayment = true;
                    }
                } else if (user?.pricingPlan === 'package') {
                    actRequiresPayment = true;
                }

                if (isPaymentKeyword || actRequiresPayment) {
                    if (!sessions.has(chatId)) {
                        sessions.set(chatId, {
                            state: 'awaiting_payment_receipt',
                            awaitingPaymentForAct: currentAct,
                            userId: user._id,
                            contractId: contract?._id,
                            paymentType: user?.pricingPlan === 'package' ? 'package' : 'individual'
                        });
                    } else {
                        const sess = sessions.get(chatId);
                        sess.awaitingPaymentForAct = sess.awaitingPaymentForAct || currentAct;
                    }
                    await handleIncomingPaymentReceipt(chatId, message, user, media);
                    return;
                }
            }


            const buttons = [
                [{ text: '📂 Subir Evidencia', callback_data: 'subir_evidencia' }],
                [{ text: '🏥 Subir Planilla SS', callback_data: 'quick_upload_planilla' }],
                [{ text: '📊 Resumen del Acta', callback_data: 'show_acts_menu' }],
                [{ text: '📦 Descargar Paquete ZIP', callback_data: 'download_zip' }]
            ];

            if (sessions.get(chatId)?.isOperator) {
                buttons.push([{ text: '👥 Cambiar de Funcionario', callback_data: 'operator_switch_user' }]);
            } else {
                buttons.push([{ text: '🔄 Cambiar de Contrato', callback_data: 'switch_contract' }]);
            }

            const isOp = sessions.get(chatId)?.isOperator;
            const greetingPrefix = isOp ? `🛡️ MODO OPERADOR (${sessions.get(chatId)?.operatorLabel})\n` : '';
            await sendTelegramKeyboardMessage(chatId, `${greetingPrefix}👋 Funcionario en gestión: ${user.fullName}. ¿Qué deseas realizar?`, buttons);
        } else {
            const privilege = await TelegramPrivilege.findOne({ telegramChatId: chatId, isActive: true });
            if (privilege) {
                await showOperatorFuncionarioMenu(chatId, privilege);
                return;
            }
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
    sendTelegramKeyboardMessage,
    sendTelegramDocument,
    handleIncomingMessage,
    handleCallbackQuery,
    checkAndAdvancePaymentStatus,
    getContractCurrentActiveAct
};

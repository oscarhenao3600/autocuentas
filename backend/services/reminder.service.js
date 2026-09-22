const Contract = require('../models/Contract');
const User = require('../models/User');
const BillingPeriod = require('../models/BillingPeriod');
const { calculatePeriods } = require('../utils/period.utils');
const { sendTelegramMessage } = require('./telegram.service');

/**
 * Returns today's date formatted as YYYY-MM-DD
 */
function getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Evaluates a contract and returns its reminder status for the current/upcoming period
 */
async function checkContractEvidenceStatus(contract, user) {
    if (!contract || !contract.startDate) {
        return null;
    }

    const periods = calculatePeriods(
        contract.startDate,
        contract.initialDurationMonths || 4,
        contract.additionDurationMonths || 0,
        contract.periodType || 'mes_cumplido',
        contract.endDate
    );

    if (!periods || periods.length === 0) return null;

    const now = new Date();

    for (const p of periods) {
        const periodStart = new Date(p.from + 'T00:00:00');
        const periodEnd = new Date(p.to + 'T23:59:59');

        // Check if we are currently within the period window or leading up to periodEnd
        const diffTime = periodEnd.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Trigger condition: 5 days or fewer remaining (0 to 5) and period has already started
        if (diffDays >= 0 && diffDays <= 5 && now >= periodStart) {
            const billingPeriod = await BillingPeriod.findOne({
                user: user._id,
                actNumber: p.actNumber
            });

            let hasEvidence = false;
            if (billingPeriod && billingPeriod.activities && billingPeriod.activities.length > 0) {
                hasEvidence = billingPeriod.activities.some(act => 
                    (act.evidences && act.evidences.length > 0) || (act.comment && act.comment.trim().length > 0)
                );
            }

            if (!hasEvidence) {
                const contractorName = contract.contractorName || user.fullName || 'contratista';
                const message = `hola ${contractorName} estamos a ${diffDays} dias para la fecha de entrega de la cuenta y aun no has subido ninguna evidencia`;

                return {
                    needsReminder: true,
                    daysRemaining: diffDays,
                    period: p,
                    actNumber: p.actNumber,
                    message,
                    contractorName
                };
            }
        }
    }

    return null;
}

/**
 * Iterates through all contracts and sends reminders via Telegram if <= 5 days and 0 evidences
 */
async function checkAndSendEvidenceReminders() {
    try {
        console.log('🔍 [ReminderService] Verificando contratos para recordatorios de evidencias...');
        const todayStr = getTodayDateString();

        const contracts = await Contract.find().populate('user');

        for (const contract of contracts) {
            const user = contract.user;
            if (!user) continue;

            const status = await checkContractEvidenceStatus(contract, user);
            if (status && status.needsReminder) {
                // Check if already notified today
                if (contract.lastEvidenceReminderDate === todayStr) {
                    console.log(`ℹ️ [ReminderService] Contratista ${status.contractorName} ya fue notificado hoy (${todayStr}).`);
                    continue;
                }

                // If user has a telegramChatId linked, send the reminder
                if (user.telegramChatId) {
                    console.log(`📢 [ReminderService] Enviando recordatorio a ${status.contractorName} (Telegram: ${user.telegramChatId})...`);
                    await sendTelegramMessage(user.telegramChatId, status.message);
                } else {
                    console.log(`ℹ️ [ReminderService] ${status.contractorName} no tiene Telegram vinculado aún.`);
                }

                // Save today's reminder date to avoid spamming
                contract.lastEvidenceReminderDate = todayStr;
                await contract.save();
            }
        }
        console.log('✅ [ReminderService] Verificación de recordatorios completada.');
    } catch (error) {
        console.error('❌ [ReminderService] Error en checkAndSendEvidenceReminders:', error.message);
    }
}

module.exports = {
    checkAndSendEvidenceReminders,
    checkContractEvidenceStatus,
    getTodayDateString
};

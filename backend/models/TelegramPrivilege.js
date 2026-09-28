const mongoose = require('mongoose');

const telegramPrivilegeSchema = new mongoose.Schema({
    telegramChatId: {
        type: String,
        required: [true, 'El ID de Telegram es requerido'],
        unique: true,
        trim: true
    },
    label: {
        type: String,
        required: [true, 'El nombre o alias del operador es requerido'],
        trim: true
    },
    description: {
        type: String,
        default: '',
        trim: true
    },
    scope: {
        type: String,
        enum: ['all', 'specific'],
        default: 'all'
    },
    assignedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    operatorType: {
        type: String,
        enum: ['standard', 'exempt', 'provider'],
        default: 'standard'
    },
    monthlyAccountsLimit: {
        type: Number,
        default: 15
    },
    accountsUsedThisMonth: {
        type: Number,
        default: 0
    },
    packageQuota: {
        type: Number,
        default: 0
    },
    packageAccountsUsed: {
        type: Number,
        default: 0
    },
    currentMonthCycle: {
        type: String,
        default: () => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
    },
    preferentialRate: {
        type: Number,
        default: 20000
    },
    canRegisterFuncionarios: {
        type: Boolean,
        default: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastActiveAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('TelegramPrivilege', telegramPrivilegeSchema);

const mongoose = require('mongoose');

const paymentReceiptSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    contract: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contract'
    },
    billingPeriod: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BillingPeriod'
    },
    telegramChatId: {
        type: String,
        required: true,
        trim: true
    },
    telegramUsername: {
        type: String,
        default: '',
        trim: true
    },
    telegramName: {
        type: String,
        default: '',
        trim: true
    },
    contractorName: {
        type: String,
        default: '',
        trim: true
    },
    contractorCedula: {
        type: String,
        default: '',
        trim: true
    },
    paymentType: {
        type: String,
        enum: ['individual', 'package'],
        default: 'individual'
    },
    actNumber: {
        type: Number,
        default: 2
    },
    packageAccountsCount: {
        type: Number,
        default: 5
    },
    amount: {
        type: Number,
        required: true,
        default: 60000
    },
    receiptFile: {
        filename: String,
        path: String,
        mimetype: String
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    rejectionReason: {
        type: String,
        default: '',
        trim: true
    },
    adminTelegramChatId: {
        type: String,
        default: '',
        trim: true
    },
    adminTelegramMessageId: {
        type: Number,
        default: null
    },
    approvedBy: {
        type: String,
        default: ''
    },
    approvedAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PaymentReceipt', paymentReceiptSchema);

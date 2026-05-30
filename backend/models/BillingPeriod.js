const mongoose = require('mongoose');

const billingPeriodSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    actNumber: {
        type: Number,
        required: true,
        default: 1
    },
    periodFrom: {
        type: Date,
        required: true
    },
    periodTo: {
        type: Date,
        required: true
    },
    activities: [{
        obligationCode: {
            type: String,
            required: true
        },
        obligationText: {
            type: String,
            required: true
        },
        comment: {
            type: String,
            required: true
        },
        evidences: [{
            filename: String,
            path: String,
            mimetype: String
        }]
    }],
    securitySocial: {
        operator: {
            type: String,
            default: ""
        },
        planillaNumber: {
            type: String,
            default: ""
        },
        totalPaid: {
            type: Number,
            default: 0
        },
        saludPaid: {
            type: Number,
            default: 0
        },
        pensionPaid: {
            type: Number,
            default: 0
        },
        arlPaid: {
            type: Number,
            default: 0
        },
        period: {
            type: String,
            default: ""
        }
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    zipPath: {
        type: String,
        default: ""
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('BillingPeriod', billingPeriodSchema);

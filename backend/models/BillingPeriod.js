const mongoose = require('mongoose');

const billingPeriodSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    contract: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contract'
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
            default: ""
        },
        obligationText: {
            type: String,
            required: true
        },
        comment: {
            type: String,
            default: ""
        },
        annexDescription: {
            type: String,
            default: ""
        },
        annexDocPath: {
            type: String,
            default: ""
        },
        annexDriveId: {
            type: String,
            default: ""
        },
        evidences: [{
            filename: String,
            path: String,
            mimetype: String,
            description: {
                type: String,
                default: ""
            }
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
        },
        ibc: {
            type: Number,
            default: 0
        },
        days: {
            type: Number,
            default: 30
        },
        periodCotizadoInicio: {
            type: String,
            default: ""
        },
        periodCotizadoFin: {
            type: String,
            default: ""
        },
        paymentDate: {
            type: String,
            default: ""
        },
        interests: {
            type: Number,
            default: 0
        }
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'discarded'],
        default: 'pending'
    },
    isDiscarded: {
        type: Boolean,
        default: false
    },
    discardedAt: {
        type: Date,
        default: null
    },
    isPaid: {
        type: Boolean,
        default: false
    },
    paymentStatus: {
        type: String,
        enum: ['free_trial', 'paid', 'pending_payment', 'exempt'],
        default: 'pending_payment'
    },
    paymentDate: {
        type: Date,
        default: null
    },
    paymentAmount: {
        type: Number,
        default: 0
    },
    paymentNotes: {
        type: String,
        default: ""
    },
    zipPath: {
        type: String,
        default: ""
    },
    zipDriveId: {
        type: String,
        default: ""
    },
    zipDownloaded: {
        type: Boolean,
        default: false
    },
    zipDownloadedAt: {
        type: Date,
        default: null
    },
    receipt: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentReceipt'
    },
    securitySocialPath: {
        type: String,
        default: ""
    },
    securitySocialReceiptPath: {
        type: String,
        default: ""
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('BillingPeriod', billingPeriodSchema);

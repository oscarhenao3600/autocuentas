const mongoose = require('mongoose');

const paymentConfigSchema = new mongoose.Schema({
    approvalTelegramChatId: {
        type: String,
        default: '',
        trim: true
    },
    approvalTelegramChatIds: [{
        type: String,
        trim: true
    }],
    contractorRate: {
        type: Number,
        default: 60000
    },
    packageRate: {
        type: Number,
        default: 100000
    },
    packageAccountsCount: {
        type: Number,
        default: 5
    },
    packageUnitRate: {
        type: Number,
        default: 20000
    },
    paymentInstructions: {
        bankName: {
            type: String,
            default: 'Bancolombia Ahorros'
        },
        accountNumber: {
            type: String,
            default: '123-456789-01'
        },
        nequiNumber: {
            type: String,
            default: '300 123 4567'
        },
        daviplataNumber: {
            type: String,
            default: '300 123 4567'
        },
        accountHolder: {
            type: String,
            default: 'Administración'
        },
        identification: {
            type: String,
            default: ''
        }
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Singleton helper to get or create configuration
paymentConfigSchema.statics.getConfig = async function() {
    let config = await this.findOne();
    if (!config) {
        config = await this.create({});
    }
    return config;
};

module.exports = mongoose.model('PaymentConfig', paymentConfigSchema);

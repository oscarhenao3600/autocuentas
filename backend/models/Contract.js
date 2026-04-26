const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    contractorName: String,
    idNumber: String,
    contractNumber: String,
    contractObject: String,
    totalValue: Number,
    monthlyValue: Number,
    duration: String,
    bankName: String,
    accountNumber: String,
    accountType: String,
    baseDocumentPath: String,
    rutPath: String,
    bankCertificatePath: String,
    securitySocialPath: String,
    stampsPath: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Contract', contractSchema);

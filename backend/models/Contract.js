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
    contractType: String,
    contractNumber: String,
    startDate: String,
    endDate: String,
    cdp: String,
    rp: String,
    rubro: String,
    totalValue: String,
    paymentValue: String,
    bankName: String,
    accountNumber: String,
    paymentMethod: String,
    monthlyValue: String,
    contractObject: String,
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

const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    entityName: {
        type: String,
        default: "Alcaldía de Armenia"
    },
    contractAlias: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ['active', 'finished'],
        default: 'active'
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
    activities: {
        type: [String],
        default: []
    },
    supervisorName: {
        type: String,
        default: ""
    },
    supervisorDependency: {
        type: String,
        default: "Secretaría de Planeación"
    },
    unidadEjecutora: {
        type: String,
        default: ""
    },
    unidadEjecutoraCodigo: {
        type: String,
        default: ""
    },
    unidadContratacion: {
        type: String,
        default: ""
    },
    fuenteFinanciacion: {
        type: String,
        default: ""
    },
    fuenteCodigo: {
        type: String,
        default: ""
    },
    contractorAddress: {
        type: String,
        default: ""
    },
    contractorPhone: {
        type: String,
        default: ""
    },
    idCity: {
        type: String,
        default: "Armenia"
    },
    contractorEmail: {
        type: String,
        default: ""
    },
    isTaxFiler: {
        type: Boolean,
        default: false
    },
    takesCosts: {
        type: Boolean,
        default: false
    },
    takesExemptRent: {
        type: Boolean,
        default: true
    },
    cutoffDay: {
        type: Number,
        default: 25
    },
    customDeliveryDate: {
        type: String,
        default: ""
    },
    deliveryNotes: {
        type: String,
        default: ""
    },
    totalValueWord: {
        type: String,
        default: ""
    },
    monthlyValueWord: {
        type: String,
        default: ""
    },
    ibcValue: {
        type: Number,
        default: 0
    },
    periodType: {
        type: String,
        enum: ['mes_cumplido', '30_dias'],
        default: 'mes_cumplido'
    },
    initialDurationMonths: {
        type: Number,
        default: 4
    },
    executionTerm: {
        type: String,
        default: ""
    },
    additionDurationMonths: {
        type: Number,
        default: 0
    },
    hasAddition: {
        type: Boolean,
        default: false
    },
    additionValue: String,
    additionValueWord: String,
    additionStartDate: String,
    additionEndDate: String,
    additionCdp: String,
    additionRp: String,
    additionRubro: String,
    additionDuration: String,
    additionDocumentPath: String,
    baseDocumentPath: String,
    actaInicioPath: String,
    rpPath: String,
    rutPath: String,
    bankCertificatePath: String,
    securitySocialPath: String,
    stampsPath: String,
    lastEvidenceReminderDate: {
        type: String,
        default: ""
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Contract', contractSchema);


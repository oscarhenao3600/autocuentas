const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, 'El nombre completo es requerido'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'El correo electrónico es requerido'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Por favor ingrese un correo válido']
    },
    password: {
        type: String,
        required: [true, 'La contraseña es requerida'],
        minlength: [8, 'La contraseña debe tener al menos 8 caracteres']
    },
    role: {
        type: String,
        enum: ['admin', 'client'],
        default: 'client'
    },
    cedula: {
        type: String,
        default: null,
        trim: true
    },
    telegramChatId: {
        type: String,
        default: null
    },
    telegramVerificationCode: {
        type: String,
        default: null
    },
    isPaymentExempt: {
        type: Boolean,
        default: false
    },
    exemptReason: {
        type: String,
        default: ''
    },
    pricingPlan: {
        type: String,
        enum: ['standard', 'package'],
        default: 'standard'
    },
    packageQuota: {
        type: Number,
        default: 0
    },
    packageAccountsUsed: {
        type: Number,
        default: 0
    },
    uiMode: {
        type: String,
        enum: ['standard', 'senior'],
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    deletionRequest: {
        requested: { type: Boolean, default: false },
        requestedAt: { type: Date, default: null },
        reason: { type: String, default: '' },
        contactPhone: { type: String, default: '' }
    },
    deletionAudit: {
        deletedAt: { type: Date, default: null },
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        deletedByName: { type: String, default: '' },
        reason: { type: String, default: '' },
        purgedFilesCount: { type: Number, default: 0 }
    },
    acceptedTerms: {
        type: Boolean,
        default: false
    },
    acceptedTermsAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to check if admin limit is reached
userSchema.statics.canRegisterAdmin = async function() {
    const adminCount = await this.countDocuments({ role: 'admin' });
    return adminCount < 5;
};

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

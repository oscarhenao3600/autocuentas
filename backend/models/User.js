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

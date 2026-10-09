const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: ['CONTRACTOR_DATA_PURGED', 'CONTRACTOR_INACTIVATED', 'CONTRACTOR_DELETION_REQUESTED', 'CONTRACTOR_REACTIVATED']
    },
    targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    targetUserName: {
        type: String,
        default: ''
    },
    targetUserCedula: {
        type: String,
        default: ''
    },
    targetUserEmail: {
        type: String,
        default: ''
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    performedByName: {
        type: String,
        default: ''
    },
    reason: {
        type: String,
        required: true
    },
    purgedFilesCount: {
        type: Number,
        default: 0
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);

const express = require('express');
const router = express.Router();
const { 
    getAllAccounts, 
    updateAccountStatus, 
    uploadTemplate, 
    getTemplates, 
    deleteTemplate,
    getRegisteredContractors,
    createContractor,
    toggleUserExemption,
    togglePeriodPayment,
    deleteUser,
    getAllDocuments,
    deleteDocument,
    getTelegramPrivileges,
    createTelegramPrivilege,
    updateTelegramPrivilege,
    toggleTelegramPrivilege,
    deleteTelegramPrivilege
} = require('../controllers/admin.controller');
const { protect, admin } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.get('/users', protect, admin, getRegisteredContractors);
router.post('/users', protect, admin, createContractor);
router.patch('/users/:id/toggle-exempt', protect, admin, toggleUserExemption);
router.patch('/periods/:id/toggle-paid', protect, admin, togglePeriodPayment);
router.delete('/users/:id', protect, admin, deleteUser);
router.get('/documents', protect, admin, getAllDocuments);
router.delete('/documents', protect, admin, deleteDocument);
router.get('/accounts', protect, admin, getAllAccounts);
router.put('/accounts/:id/status', protect, admin, updateAccountStatus);
router.get('/templates', protect, admin, getTemplates);
router.post('/template', protect, admin, upload.any(), uploadTemplate);
router.delete('/templates/:filename', protect, admin, deleteTemplate);

// Telegram Privileges Management
router.get('/telegram-privileges', protect, admin, getTelegramPrivileges);
router.post('/telegram-privileges', protect, admin, createTelegramPrivilege);
router.put('/telegram-privileges/:id', protect, admin, updateTelegramPrivilege);
router.patch('/telegram-privileges/:id/toggle', protect, admin, toggleTelegramPrivilege);
router.delete('/telegram-privileges/:id', protect, admin, deleteTelegramPrivilege);

module.exports = router;

const express = require('express');
const router = express.Router();
const { 
    getAllAccounts, 
    updateAccountStatus, 
    uploadTemplate, 
    getTemplates, 
    deleteTemplate,
    getRegisteredContractors,
    deleteUser,
    getAllDocuments,
    deleteDocument
} = require('../controllers/admin.controller');
const { protect, admin } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.get('/users', protect, admin, getRegisteredContractors);
router.delete('/users/:id', protect, admin, deleteUser);
router.get('/documents', protect, admin, getAllDocuments);
router.delete('/documents', protect, admin, deleteDocument);
router.get('/accounts', protect, admin, getAllAccounts);
router.put('/accounts/:id/status', protect, admin, updateAccountStatus);
router.get('/templates', protect, admin, getTemplates);
router.post('/template', protect, admin, upload.any(), uploadTemplate);
router.delete('/templates/:filename', protect, admin, deleteTemplate);

module.exports = router;

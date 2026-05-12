const express = require('express');
const router = express.Router();
const { getAllAccounts, updateAccountStatus, uploadTemplate } = require('../controllers/admin.controller');
const { protect, admin } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.get('/accounts', protect, admin, getAllAccounts);
router.put('/accounts/:id/status', protect, admin, updateAccountStatus);
router.post('/template', protect, admin, upload.single('templateFile'), uploadTemplate);

module.exports = router;

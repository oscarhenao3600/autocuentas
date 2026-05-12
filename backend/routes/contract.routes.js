const express = require('express');
const router = express.Router();
const { uploadBaseContract, getContract, uploadAttachments } = require('../controllers/contract.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.post('/upload-base', protect, upload.single('contractFile'), uploadBaseContract);
router.get('/', protect, getContract);

// New route for additional attachments
router.post('/upload-attachments', protect, upload.fields([
    { name: 'rut', maxCount: 1 },
    { name: 'bankCertificate', maxCount: 1 },
    { name: 'securitySocial', maxCount: 1 }
]), uploadAttachments);

module.exports = router;

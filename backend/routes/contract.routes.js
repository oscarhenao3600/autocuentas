const express = require('express');
const router = express.Router();
const { 
    uploadBaseContract, 
    getContract, 
    uploadAttachments, 
    updateContract, 
    uploadRp, 
    uploadAdditionContract, 
    uploadAdditionRp, 
    uploadActaInicio,
    getEvidenceReminderStatus
} = require('../controllers/contract.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.get('/reminder-status', protect, getEvidenceReminderStatus);
router.post('/upload-base', protect, upload.single('contractFile'), uploadBaseContract);
router.get('/', protect, getContract);
router.put('/', protect, updateContract);

// New route for additional attachments
router.post('/upload-attachments', protect, upload.fields([
    { name: 'rut', maxCount: 1 },
    { name: 'bankCertificate', maxCount: 1 },
    { name: 'securitySocial', maxCount: 1 }
]), uploadAttachments);

// Upload and process Acta de Inicio with Gemini AI
router.post('/upload-acta-inicio', protect, upload.single('actaInicioFile'), uploadActaInicio);

// Upload and process Registro Presupuestal (RP) with Gemini AI
router.post('/upload-rp', protect, upload.single('rpFile'), uploadRp);

// Upload and process Modificatorio / Adición (PDF) with Gemini AI
router.post('/upload-addition', protect, upload.single('additionFile'), uploadAdditionContract);

// Upload and process Registro Presupuestal (RP) de la adición
router.post('/upload-addition-rp', protect, upload.single('additionRpFile'), uploadAdditionRp);

module.exports = router;


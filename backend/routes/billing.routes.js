const express = require('express');
const router  = express.Router();
const {
    listMyBillingPeriods,
    getBillingPeriod,
    saveBillingPeriod,
    generatePackage,
    downloadPackage,
    getTelegramCode,
    uploadPlanillaSocial,
    improveEvidenceText
} = require('../controllers/billing.controller');
const { protect }  = require('../middleware/auth.middleware');
const upload       = require('../middleware/upload.middleware');

// Multer config: accept up to 10 evidence files per activity (up to 10 activities = 100 files max)
// Field names: evidence_0, evidence_1 ... evidence_9
const evidenceFields = Array.from({ length: 10 }, (_, i) => ({ name: `evidence_${i}`, maxCount: 10 }));

// List all billing periods for logged user
router.get('/',              protect, listMyBillingPeriods);

// Upload and process Security Social Planilla PDF with Gemini
router.post('/upload-planilla', protect, upload.single('planillaFile'), uploadPlanillaSocial);

// Improve evidence description using Gemini AI
router.post('/improve-evidence-text', protect, improveEvidenceText);

// Get a single billing period
router.get('/:id',           protect, getBillingPeriod);

// Create or update a draft billing period (with optional evidence uploads)
router.post('/',             protect, upload.fields(evidenceFields), saveBillingPeriod);

// Generate all 4 Word docs + ZIP package
router.post('/:id/generate', protect, generatePackage);

// Download the generated ZIP
router.get('/:id/download',  protect, downloadPackage);

// Generate Telegram linking code
router.get('/telegram/code', protect, getTelegramCode);

module.exports = router;

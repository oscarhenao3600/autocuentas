const express = require('express');
const router = express.Router();
const { uploadBaseContract, getContract } = require('../controllers/contract.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.post('/upload-base', protect, upload.single('contractFile'), uploadBaseContract);
router.get('/', protect, getContract);

module.exports = router;

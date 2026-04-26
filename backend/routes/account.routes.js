const express = require('express');
const router = express.Router();
const { createAccount, getMyAccounts } = require('../controllers/account.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.post('/', protect, upload.array('files', 10), createAccount);
router.get('/my', protect, getMyAccounts);

module.exports = router;

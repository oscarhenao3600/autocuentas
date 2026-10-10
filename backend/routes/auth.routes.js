const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, login } = require('../controllers/auth.controller');

// Dedicated rate limiter for authentication endpoints (prevents brute-force credential guessing)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 10,                  // Limit each IP to 10 login/register attempts per window
    message: { message: 'Demasiados intentos de acceso desde esta dirección IP. Intente nuevamente en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

module.exports = router;

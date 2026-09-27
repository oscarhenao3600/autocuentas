const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

const app = express();

// Security Middlewares
app.use(helmet({
    hsts: false,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Limit body size to prevent DoS

// Workaround for express-mongo-sanitize incompatibility with Express 5 (req.query is a getter-only property)
app.use((req, res, next) => {
    Object.defineProperty(req, 'query', {
        value: { ...req.query },
        writable: true,
        configurable: true,
        enumerable: true
    });
    next();
});

app.use(mongoSanitize()); // Prevent NoSQL injection

// Rate Limiting to prevent brute force
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter);

// MongoDB Connection with auto-retry (resilient for slow Raspberry Pi boot)
const connectMongoWithRetry = () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27019/formatos_cuentas';
    mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
    })
    .then(async () => {
        console.log('✅ Connected to MongoDB safely');
        try {
            // Safely drop obsolete unique index on contracts.user to allow multiple contracts per user
            await mongoose.connection.db.collection('contracts').dropIndex('user_1');
            console.log('ℹ️ Índice único user_1 en contracts removido con éxito para soporte multi-contrato');
        } catch (_) {}
    })
    .catch(err => {
        console.error('⚠️ MongoDB Connection Error:', err.message);
        console.log('⏳ Reintentando conexión a MongoDB en 5 segundos...');
        setTimeout(connectMongoWithRetry, 5000);
    });
};
connectMongoWithRetry();

// Static files for downloads
const path = require('path');
app.use('/generated', express.static(path.join(__dirname, 'generated')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth',      require('./routes/auth.routes'));
app.use('/api/accounts',  require('./routes/account.routes'));
app.use('/api/contracts', require('./routes/contract.routes'));
app.use('/api/admin',     require('./routes/admin.routes'));
app.use('/api/billing',   require('./routes/billing.routes'));

app.get('/', (req, res) => {
    res.send('Formatos Cuentas API is running securely.');
});

// Production Health Check Endpoint
app.get('/api/health', (req, res) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    const mem = process.memoryUsage();
    res.status(isDbConnected ? 200 : 503).json({
        status: isDbConnected ? 'UP' : 'DEGRADED',
        database: isDbConnected ? 'connected' : 'disconnected',
        uptimeSeconds: Math.floor(process.uptime()),
        memoryRssMB: Math.round(mem.rss / (1024 * 1024)),
        memoryHeapUsedMB: Math.round(mem.heapUsed / (1024 * 1024)),
        timestamp: new Date().toISOString()
    });
});

// Basic Error Handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    // Start Telegram Bot Service if token is available
    if (process.env.TELEGRAM_BOT_TOKEN) {
        const { startTelegramPolling } = require('./services/telegram.service');
        startTelegramPolling();
    } else {
        console.log('ℹ️ Telegram Bot service not active (TELEGRAM_BOT_TOKEN missing in .env)');
    }

    // Initialize Evidence Reminder Service (runs on startup + every 4 hours)
    const { checkAndSendEvidenceReminders } = require('./services/reminder.service');
    setTimeout(() => {
        checkAndSendEvidenceReminders();
    }, 10000);
    setInterval(() => {
        checkAndSendEvidenceReminders();
    }, 4 * 60 * 60 * 1000);
});

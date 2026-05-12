const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

const app = express();

// Security Middlewares
app.use(helmet()); // Sets various HTTP headers for security
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173', // Vite default
    credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Limit body size to prevent DoS
app.use(mongoSanitize()); // Prevent NoSQL injection

// Rate Limiting to prevent brute force
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB safely'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
    });

// Static files for downloads
const path = require('path');
app.use('/generated', express.static(path.join(__dirname, 'generated')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/accounts', require('./routes/account.routes'));
app.use('/api/contracts', require('./routes/contract.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

app.get('/', (req, res) => {
    res.send('Formatos Cuentas API is running securely.');
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
});

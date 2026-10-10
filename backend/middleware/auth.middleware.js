const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyJwtToken = (token) => {
    const primarySecret = process.env.JWT_SECRET || 'supersecretkey_change_me_in_production';
    const fallbackSecrets = [
        process.env.JWT_OLD_SECRET,
        'supersecretkey_change_me_in_production'
    ].filter(s => s && s !== primarySecret);

    try {
        return jwt.verify(token, primarySecret);
    } catch (primaryErr) {
        for (const fallback of fallbackSecrets) {
            try {
                return jwt.verify(token, fallback);
            } catch (_) {}
        }
        throw primaryErr;
    }
};

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
        token = req.query.token;
    }

    if (token) {
        try {
            const decoded = verifyJwtToken(token);
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'No autorizado, usuario no encontrado' });
            }

            if (req.user.status === 'inactive' || req.user.isActive === false) {
                return res.status(403).json({ message: 'Usuario inactivado en el sistema por proceso de auditoría y eliminación de datos.' });
            }

            return next();
        } catch (error) {
            return res.status(401).json({ message: 'No autorizado, token fallido' });
        }
    }

    return res.status(401).json({ message: 'No autorizado, no hay token' });
};

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(401).json({ message: 'No autorizado como administrador' });
    }
};

module.exports = { protect, admin };

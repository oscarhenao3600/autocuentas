const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

exports.register = async (req, res) => {
    try {
        const { fullName, email, password, role } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'El usuario ya existe' });
        }

        // Check admin limit if registering as admin
        if (role === 'admin') {
            const canRegister = await User.canRegisterAdmin();
            if (!canRegister) {
                return res.status(400).json({ message: 'Se ha alcanzado el límite máximo de 5 administradores' });
            }
        }

        const user = await User.create({
            fullName,
            email,
            password,
            role: role || 'client'
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                token: generateToken(user._id)
            });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (user && (await user.comparePassword(password))) {
            res.json({
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({ message: 'Correo o contraseña inválidos' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

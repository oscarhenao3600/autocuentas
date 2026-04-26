const Account = require('../models/Account');

exports.createAccount = async (req, res) => {
    try {
        const { activity, date, description } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'Por favor suba al menos una evidencia' });
        }

        const evidences = files.map(file => ({
            filename: file.originalname,
            path: file.path,
            mimetype: file.mimetype
        }));

        const account = await Account.create({
            user: req.user._id,
            activity,
            date,
            description,
            evidences
        });

        res.status(201).json(account);
    } catch (error) {
        res.status(500).json({ message: 'Error al crear la cuenta', error: error.message });
    }
};

exports.getMyAccounts = async (req, res) => {
    try {
        const accounts = await Account.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener cuentas', error: error.message });
    }
};

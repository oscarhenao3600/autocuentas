const Account = require('../models/Account');

exports.getAllAccounts = async (req, res) => {
    try {
        // Fetch accounts and populate user info
        const accounts = await Account.find()
            .populate('user', 'fullName email')
            .sort({ createdAt: -1 });
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener cuentas', error: error.message });
    }
};

exports.updateAccountStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const account = await Account.findById(req.params.id);

        if (!account) {
            return res.status(404).json({ message: 'Cuenta no encontrada' });
        }

        account.status = status;
        await account.save();

        res.json({ message: 'Estado actualizado correctamente', account });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar cuenta', error: error.message });
    }
};

// For Configure Formats - dummy endpoint for now to represent saving a template
exports.uploadTemplate = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba la plantilla' });
        }
        res.json({ message: 'Plantilla subida con éxito', filename: req.file.filename });
    } catch (error) {
        res.status(500).json({ message: 'Error al subir plantilla', error: error.message });
    }
};

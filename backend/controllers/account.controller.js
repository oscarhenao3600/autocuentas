const Account = require('../models/Account');
const Contract = require('../models/Contract');
const { generateDocument } = require('../services/document.service');

exports.createAccount = async (req, res) => {
    try {
        const { activity, date, description } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'Por favor suba al menos una evidencia' });
        }

        const contract = await Contract.findOne({ user: req.user._id });
        if (!contract) {
            return res.status(400).json({ message: 'Debe configurar su contrato antes de crear una cuenta' });
        }

        const evidences = files.map(file => ({
            filename: file.originalname,
            path: file.path,
            mimetype: file.mimetype
        }));

        let account = await Account.create({
            user: req.user._id,
            activity,
            date,
            description,
            evidences
        });

        try {
            const docData = {
                contractorName: contract.contractorName,
                idNumber: contract.idNumber,
                contractNumber: contract.contractNumber,
                activity: account.activity,
                date: account.date,
                description: account.description
            };
            
            const generated = await generateDocument('FORMATO INFORME DE ACTIVIDADES.docx', docData);
            account.generatedDocumentPath = generated.outputPath;
            await account.save();
        } catch (genError) {
            console.error('Document generation warning:', genError);
            // Optionally we can let it pass and the document will be missing, or fail entirely.
        }

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

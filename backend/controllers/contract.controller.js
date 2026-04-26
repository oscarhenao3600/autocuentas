const Contract = require('../models/Contract');
const { extractContractData } = require('../services/gemini.service');

exports.uploadBaseContract = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba el documento del contrato' });
        }

        // 1. Extract data with Gemini
        const extractedData = await extractContractData(req.file.path);

        // 2. Save or Update in DB
        let contract = await Contract.findOne({ user: req.user._id });

        if (contract) {
            Object.assign(contract, extractedData, { baseDocumentPath: req.file.path });
            await contract.save();
        } else {
            contract = await Contract.create({
                user: req.user._id,
                ...extractedData,
                baseDocumentPath: req.file.path
            });
        }

        res.json({
            message: 'Contrato procesado con éxito por la IA',
            data: contract
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al procesar el contrato', error: error.message });
    }
};

exports.getContract = async (req, res) => {
    try {
        const contract = await Contract.findOne({ user: req.user._id });
        if (!contract) return res.status(404).json({ message: 'No se encontró información de contrato' });
        res.json(contract);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener contrato', error: error.message });
    }
};

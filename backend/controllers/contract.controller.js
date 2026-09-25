const fs = require('fs');
const Contract = require('../models/Contract');
const { extractContractData, extractRpData, extractBankCertificateData, extractActaInicioData, extractRutData } = require('../services/gemini.service');
const { filterSpecificObligations } = require('../utils/period.utils');
const { checkContractEvidenceStatus } = require('../services/reminder.service');

exports.uploadBaseContract = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba el documento del contrato' });
        }

        // 1. Extract data with Gemini
        const extractedData = await extractContractData(req.file.path);

        // Filter out general obligations if any were extracted
        if (extractedData.activities && Array.isArray(extractedData.activities)) {
            extractedData.activities = filterSpecificObligations(extractedData.activities);
        }

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

exports.uploadAttachments = async (req, res) => {
    try {
        const contract = await Contract.findOne({ user: req.user._id });
        if (!contract) {
            return res.status(404).json({ message: 'Primero debe configurar su contrato base' });
        }

        const updates = {};
        let bankExtracted = null;
        let rutExtracted = null;

        // Gather candidate passwords: cédula from contract
        const candidates = [];
        if (contract.idNumber) {
            candidates.push(contract.idNumber.trim());
            const cleanCedula = contract.idNumber.replace(/\D/g, '');
            if (cleanCedula && cleanCedula !== contract.idNumber.trim()) {
                candidates.push(cleanCedula);
            }
        }

        if (req.files.securitySocial) updates.securitySocialPath = req.files.securitySocial[0].path;

        if (req.files.rut) {
            const file = req.files.rut[0];
            updates.rutPath = file.path;

            try {
                console.log("Procesando RUT con IA...");
                rutExtracted = await extractRutData(file.path, {
                    password: req.body.rutPassword,
                    candidatePasswords: candidates
                });

                if (rutExtracted) {
                    if (rutExtracted.contractorAddress) updates.contractorAddress = rutExtracted.contractorAddress;
                    if (rutExtracted.idCity) updates.idCity = rutExtracted.idCity;
                    if (typeof rutExtracted.isTaxFiler === 'boolean') updates.isTaxFiler = rutExtracted.isTaxFiler;
                    if (rutExtracted.contractorPhone && !contract.contractorPhone) updates.contractorPhone = rutExtracted.contractorPhone;
                    if (rutExtracted.contractorEmail && !contract.contractorEmail) updates.contractorEmail = rutExtracted.contractorEmail;
                    console.log("Datos del RUT extraídos:", rutExtracted);
                }
            } catch (err) {
                if (err.code === 'PASSWORD_REQUIRED') {
                    Object.assign(contract, updates);
                    await contract.save();

                    return res.status(200).json({
                        requiresPassword: true,
                        docType: 'rut',
                        invalidPassword: Boolean(req.body.rutPassword),
                        message: req.body.rutPassword
                            ? "La contraseña ingresada es incorrecta para el RUT."
                            : (candidates.length > 0
                                ? "El RUT está protegido con contraseña. Intentamos abrirlo automáticamente con tu número de cédula pero no coincidió. Por favor ingresa la contraseña para procesarlo con la IA."
                                : "El RUT está protegido con contraseña. Por favor ingresa la contraseña para procesarlo con la IA."),
                        data: contract
                    });
                }
                console.error("No se pudo extraer información del RUT:", err.message);
            }
        }

        if (req.files.bankCertificate) {
            const file = req.files.bankCertificate[0];
            updates.bankCertificatePath = file.path;

            try {
                console.log("Procesando Certificado Bancario con IA...");
                bankExtracted = await extractBankCertificateData(file.path, {
                    password: req.body.bankCertificatePassword,
                    candidatePasswords: candidates
                });

                if (bankExtracted) {
                    if (bankExtracted.bankName) updates.bankName = bankExtracted.bankName;
                    if (bankExtracted.accountNumber) updates.accountNumber = bankExtracted.accountNumber;
                    if (bankExtracted.paymentMethod) updates.paymentMethod = bankExtracted.paymentMethod;
                    console.log("Datos bancarios extraídos:", bankExtracted);
                }
            } catch (err) {
                if (err.code === 'PASSWORD_REQUIRED') {
                    // Save uploaded attachment path so user can unlock it without re-uploading
                    Object.assign(contract, updates);
                    await contract.save();

                    return res.status(200).json({
                        requiresPassword: true,
                        docType: 'bankCertificate',
                        invalidPassword: Boolean(req.body.bankCertificatePassword),
                        message: req.body.bankCertificatePassword
                            ? "La contraseña ingresada es incorrecta para este documento."
                            : (candidates.length > 0
                                ? "El certificado bancario está protegido con contraseña. Intentamos abrirlo automáticamente con tu número de cédula pero no coincidió. Por favor ingresa la contraseña para procesarlo con la IA."
                                : "El certificado bancario está protegido con contraseña. Por favor ingresa la contraseña para procesarlo con la IA."),
                        data: contract
                    });
                }
                console.error("No se pudo extraer información del certificado bancario:", err.message);
            }
        }

        Object.assign(contract, updates);
        await contract.save();

        let message = 'Anexos actualizados con éxito';
        if (bankExtracted) {
            if (bankExtracted.unlockedWithCedula) {
                message = 'Anexos actualizados y certificado bancario desbloqueado automáticamente con tu cédula y procesado por la IA con éxito';
            } else if (bankExtracted.unlockedWithPassword) {
                message = 'Anexos actualizados y certificado bancario desbloqueado con la contraseña ingresada y procesado por la IA con éxito';
            } else {
                message = 'Anexos actualizados y certificado bancario procesado por la IA con éxito';
            }
        } else if (rutExtracted) {
            if (rutExtracted.unlockedWithCedula) {
                message = 'Anexos actualizados y RUT desbloqueado automáticamente con tu cédula y procesado por la IA con éxito';
            } else if (rutExtracted.unlockedWithPassword) {
                message = 'Anexos actualizados y RUT desbloqueado con la contraseña ingresada y procesado por la IA con éxito';
            } else {
                message = 'Anexos actualizados y RUT procesado por la IA con éxito';
            }
        }

        res.json({
            message,
            data: contract,
            extracted: bankExtracted || rutExtracted
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al subir anexos', error: error.message });
    }
};

exports.unlockBankCertificate = async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || !password.trim()) {
            return res.status(400).json({ message: 'Por favor ingresa la contraseña del certificado bancario' });
        }

        const contract = await Contract.findOne({ user: req.user._id });
        if (!contract || !contract.bankCertificatePath) {
            return res.status(404).json({ message: 'No hay un certificado bancario cargado previamente' });
        }

        if (!fs.existsSync(contract.bankCertificatePath)) {
            return res.status(404).json({ message: 'El archivo del certificado bancario no fue encontrado en el servidor. Por favor vuelve a subirlo.' });
        }

        try {
            console.log("Intentando desbloquear certificado bancario con contraseña ingresada...");
            const bankExtracted = await extractBankCertificateData(contract.bankCertificatePath, {
                password: password.trim(),
                candidatePasswords: []
            });

            if (bankExtracted) {
                if (bankExtracted.bankName) contract.bankName = bankExtracted.bankName;
                if (bankExtracted.accountNumber) contract.accountNumber = bankExtracted.accountNumber;
                if (bankExtracted.paymentMethod) contract.paymentMethod = bankExtracted.paymentMethod;
                await contract.save();
            }

            return res.json({
                success: true,
                message: '¡Certificado bancario desbloqueado y procesado por IA con éxito! Datos bancarios actualizados.',
                data: contract,
                extracted: bankExtracted
            });
        } catch (err) {
            if (err.code === 'PASSWORD_REQUIRED') {
                return res.status(400).json({
                    requiresPassword: true,
                    docType: 'bankCertificate',
                    invalidPassword: true,
                    message: 'Contraseña incorrecta. Por favor verifica e intenta nuevamente.'
                });
            }
            return res.status(500).json({
                message: 'Error al procesar el certificado con IA: ' + err.message
            });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error al desbloquear certificado', error: error.message });
    }
};

exports.unlockRut = async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || !password.trim()) {
            return res.status(400).json({ message: 'Por favor ingresa la contraseña del RUT' });
        }

        const contract = await Contract.findOne({ user: req.user._id });
        if (!contract || !contract.rutPath) {
            return res.status(404).json({ message: 'No hay un RUT cargado previamente' });
        }

        if (!fs.existsSync(contract.rutPath)) {
            return res.status(404).json({ message: 'El archivo del RUT no fue encontrado en el servidor. Por favor vuelve a subirlo.' });
        }

        try {
            console.log("Intentando desbloquear RUT con contraseña ingresada...");
            const rutExtracted = await extractRutData(contract.rutPath, {
                password: password.trim(),
                candidatePasswords: []
            });

            if (rutExtracted) {
                if (rutExtracted.contractorAddress) contract.contractorAddress = rutExtracted.contractorAddress;
                if (rutExtracted.idCity) contract.idCity = rutExtracted.idCity;
                if (typeof rutExtracted.isTaxFiler === 'boolean') contract.isTaxFiler = rutExtracted.isTaxFiler;
                if (rutExtracted.contractorPhone && !contract.contractorPhone) contract.contractorPhone = rutExtracted.contractorPhone;
                if (rutExtracted.contractorEmail && !contract.contractorEmail) contract.contractorEmail = rutExtracted.contractorEmail;
                await contract.save();
            }

            return res.json({
                success: true,
                message: '¡RUT desbloqueado y procesado por IA con éxito! Datos fiscales actualizados.',
                data: contract,
                extracted: rutExtracted
            });
        } catch (err) {
            if (err.code === 'PASSWORD_REQUIRED') {
                return res.status(400).json({
                    requiresPassword: true,
                    docType: 'rut',
                    invalidPassword: true,
                    message: 'Contraseña incorrecta. Por favor verifica e intenta nuevamente.'
                });
            }
            return res.status(500).json({
                message: 'Error al procesar el RUT con IA: ' + err.message
            });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error al desbloquear el RUT', error: error.message });
    }
};

exports.updateContract = async (req, res) => {
    try {
        let contract = await Contract.findOne({ user: req.user._id });
        if (!contract) {
            contract = new Contract({ user: req.user._id });
        }

        const allowedFields = [
            'contractorName', 'idNumber', 'contractType', 'contractNumber',
            'startDate', 'endDate', 'cdp', 'rp', 'rubro', 'totalValue',
            'paymentValue', 'bankName', 'accountNumber', 'paymentMethod',
            'monthlyValue', 'contractObject', 'activities', 'supervisorName', 'supervisorDependency',
            'contractorAddress', 'contractorPhone',
            'idCity', 'contractorEmail', 'isTaxFiler', 'takesCosts', 'takesExemptRent',
            'periodType', 'initialDurationMonths', 'additionDurationMonths', 'hasAddition',
            'additionValue', 'additionValueWord', 'additionStartDate', 'additionEndDate',
            'additionCdp', 'additionRp', 'additionRubro', 'additionDuration',
            'executionTerm'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                contract[field] = req.body[field];
            }
        });

        await contract.save();

        res.json({
            message: 'Contrato actualizado con éxito',
            data: contract
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar el contrato', error: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// POST /api/contracts/upload-rp  →  Process Registro Presupuestal with Gemini
// ──────────────────────────────────────────────────────────────
exports.uploadRp = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba el documento del Registro Presupuestal (RP)' });
        }

        // Extract RP data with Gemini AI
        const rpData = await extractRpData(req.file.path);

        // Find (or create) the user's contract and patch the RP fields
        let contract = await Contract.findOne({ user: req.user._id });
        if (!contract) {
            return res.status(400).json({ message: 'Primero debe subir el contrato base antes de cargar el RP' });
        }

        if (rpData.rpNumber)  contract.rp    = rpData.rpNumber;
        if (rpData.cdpNumber) contract.cdp   = rpData.cdpNumber;
        if (rpData.rubro)     contract.rubro  = rpData.rubro;
        if (rpData.rpDate)    contract.rpDate = rpData.rpDate;

        await contract.save();

        res.json({
            message: 'Registro Presupuestal procesado con éxito por la IA',
            extracted: rpData,
            data: contract
        });
    } catch (error) {
        console.error('Error uploadRp:', error);
        res.status(500).json({ message: 'Error al procesar el RP', error: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// POST /api/contracts/upload-addition  →  Process Modificatorio PDF with Gemini
// ──────────────────────────────────────────────────────────────
exports.uploadAdditionContract = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba el documento modificatorio de la adición' });
        }

        // 1. Extract data with Gemini
        const extractedData = await extractAdditionContractData(req.file.path);

        // 2. Save or Update in DB
        let contract = await Contract.findOne({ user: req.user._id });

        if (!contract) {
            return res.status(400).json({ message: 'Primero debe configurar su contrato base antes de cargar una adición' });
        }

        Object.assign(contract, extractedData, { 
            hasAddition: true,
            additionDocumentPath: req.file.path 
        });
        await contract.save();

        res.json({
            message: 'Modificatorio de adición procesado con éxito por la IA',
            data: contract
        });
    } catch (error) {
        console.error('Error uploadAdditionContract:', error);
        res.status(500).json({ message: 'Error al procesar la adición', error: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// POST /api/contracts/upload-addition-rp  →  Process RP de Adición with Gemini
// ──────────────────────────────────────────────────────────────
exports.uploadAdditionRp = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba el documento del Registro Presupuestal (RP) de la adición' });
        }

        // Extract RP data with Gemini AI
        const rpData = await extractRpData(req.file.path);

        // Find the user's contract and patch the addition RP fields
        let contract = await Contract.findOne({ user: req.user._id });
        if (!contract) {
            return res.status(400).json({ message: 'Primero debe configurar su contrato base antes de cargar el RP de adición' });
        }

        if (rpData.rpNumber)  contract.additionRp    = rpData.rpNumber;
        if (rpData.cdpNumber) contract.additionCdp   = rpData.cdpNumber;
        if (rpData.rubro)     contract.additionRubro  = rpData.rubro;

        await contract.save();

        res.json({
            message: 'Registro Presupuestal de la adición procesado con éxito por la IA',
            extracted: rpData,
            data: contract
        });
    } catch (error) {
        console.error('Error uploadAdditionRp:', error);
        res.status(500).json({ message: 'Error al procesar el RP de la adición', error: error.message });
    }
};

// ──────────────────────────────────────────────────────────────
// POST /api/contracts/upload-acta-inicio  →  Process Acta de Inicio with Gemini
// ──────────────────────────────────────────────────────────────
exports.uploadActaInicio = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba el documento del Acta de Inicio' });
        }

        const actaData = await extractActaInicioData(req.file.path);

        let contract = await Contract.findOne({ user: req.user._id });
        if (!contract) {
            return res.status(400).json({ message: 'Primero debe configurar su contrato base antes de cargar el Acta de Inicio' });
        }

        contract.actaInicioPath = req.file.path;
        if (actaData.startDate) contract.startDate = actaData.startDate;
        if (actaData.endDate) contract.endDate = actaData.endDate;
        if (actaData.contractNumber && !contract.contractNumber) contract.contractNumber = actaData.contractNumber;
        if (actaData.supervisorName && !contract.supervisorName) contract.supervisorName = actaData.supervisorName;
        if (actaData.initialDurationMonths) contract.initialDurationMonths = Number(actaData.initialDurationMonths);
        if (actaData.executionTerm && !contract.executionTerm) contract.executionTerm = actaData.executionTerm;

        await contract.save();

        res.json({
            message: 'Acta de Inicio procesada con éxito por la IA',
            extracted: actaData,
            data: contract
        });
    } catch (error) {
        console.error('Error uploadActaInicio:', error);
        res.status(500).json({ message: 'Error al procesar el Acta de Inicio', error: error.message });
    }
};

exports.getEvidenceReminderStatus = async (req, res) => {
    try {
        const contract = await Contract.findOne({ user: req.user._id });
        if (!contract) return res.json({ needsReminder: false });
        const status = await checkContractEvidenceStatus(contract, req.user);
        res.json(status || { needsReminder: false });
    } catch (error) {
        console.error('Error en getEvidenceReminderStatus:', error);
        res.status(500).json({ message: 'Error al verificar recordatorios', error: error.message });
    }
};




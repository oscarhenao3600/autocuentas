const fs = require('fs');
const path = require('path');
const Contract = require('../models/Contract');
const User = require('../models/User');
const storageService = require('../services/storage.service');
const { 
    extractContractData, 
    extractRpData, 
    extractBankCertificateData, 
    extractActaInicioData, 
    extractRutData, 
    extractSecuritySocialData 
} = require('../services/gemini.service');
const { filterSpecificObligations } = require('../utils/period.utils');
const { checkContractEvidenceStatus } = require('../services/reminder.service');

const resolveContract = async (userId, contractId = null) => {
    if (contractId) {
        const c = await Contract.findOne({ _id: contractId, user: userId });
        if (c) return c;
    }
    return await Contract.findOne({ user: userId }).sort({ createdAt: -1 });
};

const getContractorFolder = (contract, user) => {
    const id = contract?.idNumber || user?.cedula || user?._id || 'Contratista';
    const name = (contract?.contractorName || user?.fullName || 'Contratista').replace(/[^a-zA-Z0-9]/g, '_');
    return `${id}_${name}`;
};

exports.listMyContracts = async (req, res) => {
    try {
        const contracts = await Contract.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(contracts);
    } catch (error) {
        res.status(500).json({ message: 'Error al listar contratos', error: error.message });
    }
};

exports.uploadBaseContract = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba el documento del contrato' });
        }

        const user = await User.findById(req.user._id);
        const contractorFolder = getContractorFolder(null, user);
        const fileBuffer = req.file.buffer || (req.file.path && fs.existsSync(req.file.path) ? fs.readFileSync(req.file.path) : null);

        // 1. Upload to Google Drive directly
        const uploaded = await storageService.saveFile({
            buffer: fileBuffer,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            pathSegments: ['Contratistas', contractorFolder, 'Contratos_Base']
        });

        // 2. Extract data with Gemini using the in-memory buffer
        const extractedData = await extractContractData(fileBuffer, {
            filename: req.file.originalname,
            mimetype: req.file.mimetype
        });

        // Filter out general obligations if any were extracted
        if (extractedData.activities && Array.isArray(extractedData.activities)) {
            extractedData.activities = filterSpecificObligations(extractedData.activities);
        }

        const contractId = req.body.contractId;
        const isNewContract = req.body.isNewContract === 'true' || req.body.isNewContract === true;

        let contract = null;
        if (contractId) {
            contract = await Contract.findOne({ _id: contractId, user: req.user._id });
        } else if (!isNewContract) {
            if (extractedData.contractNumber) {
                contract = await Contract.findOne({ user: req.user._id, contractNumber: extractedData.contractNumber });
            }
            if (!contract) {
                const userContracts = await Contract.find({ user: req.user._id });
                if (userContracts.length === 1 && !userContracts[0].contractNumber) {
                    contract = userContracts[0];
                }
            }
        }

        if (contract) {
            Object.assign(contract, extractedData, { baseDocumentPath: uploaded.path });
            if (extractedData.entityName) contract.entityName = extractedData.entityName;
            await contract.save();
        } else {
            contract = await Contract.create({
                user: req.user._id,
                ...extractedData,
                baseDocumentPath: uploaded.path
            });
        }

        res.json({
            message: 'Contrato procesado y respaldado en Google Drive con éxito',
            data: contract
        });
    } catch (error) {
        console.error('Error uploadBaseContract:', error);
        res.status(500).json({ message: 'Error al procesar el contrato', error: error.message });
    }
};

exports.getContract = async (req, res) => {
    try {
        const contractId = req.params.id || req.query.contractId;
        const contract = await resolveContract(req.user._id, contractId);
        if (!contract) return res.status(404).json({ message: 'No se encontró información de contrato' });
        res.json(contract);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener contrato', error: error.message });
    }
};

exports.uploadAttachments = async (req, res) => {
    try {
        const contractId = req.body.contractId || req.query.contractId;
        const contract = await resolveContract(req.user._id, contractId);
        if (!contract) {
            return res.status(404).json({ message: 'Primero debe configurar su contrato base' });
        }

        const user = await User.findById(req.user._id);
        const contractorFolder = getContractorFolder(contract, user);
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

        let securitySocialExtracted = null;

        if (req.files.securitySocial) {
            const file = req.files.securitySocial[0];
            const fileBuffer = file.buffer || (file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path) : null);

            const uploaded = await storageService.saveFile({
                buffer: fileBuffer,
                filename: file.originalname,
                mimetype: file.mimetype,
                pathSegments: ['Contratistas', contractorFolder, 'Anexos']
            });
            updates.securitySocialPath = uploaded.path;

            try {
                console.log("Procesando Planilla de Seguridad Social con IA...");
                securitySocialExtracted = await extractSecuritySocialData(fileBuffer, {
                    filename: file.originalname,
                    mimetype: file.mimetype,
                    password: req.body.securitySocialPassword,
                    candidatePasswords: candidates
                });

                if (securitySocialExtracted?.cleanBuffer) {
                    const cleanUploaded = await storageService.saveFile({
                        buffer: securitySocialExtracted.cleanBuffer,
                        filename: `Seguridad_Social_Limpia_${Date.now()}.pdf`,
                        mimetype: 'application/pdf',
                        pathSegments: ['Contratistas', contractorFolder, 'Anexos']
                    });
                    updates.securitySocialPath = cleanUploaded.path;
                }
            } catch (err) {
                if (err.code === 'PASSWORD_REQUIRED') {
                    Object.assign(contract, updates);
                    await contract.save();

                    return res.status(200).json({
                        requiresPassword: true,
                        docType: 'securitySocial',
                        invalidPassword: Boolean(req.body.securitySocialPassword),
                        message: req.body.securitySocialPassword
                            ? "La contraseña ingresada es incorrecta para la planilla de seguridad social."
                            : (candidates.length > 0
                                ? "La planilla de seguridad social está protegida con contraseña. Intentamos abrirla automáticamente con tu número de cédula pero no coincidió. Por favor ingresa la contraseña para procesarla con la IA."
                                : "La planilla de seguridad social está protegida con contraseña. Por favor ingresa la contraseña para procesarla con la IA."),
                        data: contract
                    });
                }
                console.error("No se pudo extraer información de la planilla de seguridad social:", err.message);
            }
        }

        if (req.files.rut) {
            const file = req.files.rut[0];
            const fileBuffer = file.buffer || (file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path) : null);

            const uploaded = await storageService.saveFile({
                buffer: fileBuffer,
                filename: file.originalname,
                mimetype: file.mimetype,
                pathSegments: ['Contratistas', contractorFolder, 'Anexos']
            });
            updates.rutPath = uploaded.path;

            try {
                console.log("Procesando RUT con IA...");
                rutExtracted = await extractRutData(fileBuffer, {
                    filename: file.originalname,
                    mimetype: file.mimetype,
                    password: req.body.rutPassword,
                    candidatePasswords: candidates
                });

                if (rutExtracted) {
                    if (rutExtracted.cleanBuffer) {
                        const cleanUploaded = await storageService.saveFile({
                            buffer: rutExtracted.cleanBuffer,
                            filename: `RUT_Limpio_${Date.now()}.pdf`,
                            mimetype: 'application/pdf',
                            pathSegments: ['Contratistas', contractorFolder, 'Anexos']
                        });
                        updates.rutPath = cleanUploaded.path;
                    }

                    if (rutExtracted.contractorAddress) updates.contractorAddress = rutExtracted.contractorAddress;
                    if (rutExtracted.idCity) updates.idCity = rutExtracted.idCity;
                    if (typeof rutExtracted.isTaxFiler === 'boolean') updates.isTaxFiler = rutExtracted.isTaxFiler;
                    if (rutExtracted.contractorPhone && !contract.contractorPhone) updates.contractorPhone = rutExtracted.contractorPhone;
                    if (rutExtracted.contractorEmail && !contract.contractorEmail) updates.contractorEmail = rutExtracted.contractorEmail;
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
                                ? "El RUT está protegido con contraseña. Intentamos abrirla automáticamente con tu número de cédula pero no coincidió. Por favor ingresa la contraseña para procesarlo con la IA."
                                : "El RUT está protegido con contraseña. Por favor ingresa la contraseña para procesarlo con la IA."),
                        data: contract
                    });
                }
                console.error("No se pudo extraer información del RUT:", err.message);
            }
        }

        if (req.files.bankCertificate) {
            const file = req.files.bankCertificate[0];
            const fileBuffer = file.buffer || (file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path) : null);

            const uploaded = await storageService.saveFile({
                buffer: fileBuffer,
                filename: file.originalname,
                mimetype: file.mimetype,
                pathSegments: ['Contratistas', contractorFolder, 'Anexos']
            });
            updates.bankCertificatePath = uploaded.path;

            try {
                console.log("Procesando Certificado Bancario con IA...");
                bankExtracted = await extractBankCertificateData(fileBuffer, {
                    filename: file.originalname,
                    mimetype: file.mimetype,
                    password: req.body.bankCertificatePassword,
                    candidatePasswords: candidates
                });

                if (bankExtracted) {
                    if (bankExtracted.cleanBuffer) {
                        const cleanUploaded = await storageService.saveFile({
                            buffer: bankExtracted.cleanBuffer,
                            filename: `Certificado_Bancario_Limpio_${Date.now()}.pdf`,
                            mimetype: 'application/pdf',
                            pathSegments: ['Contratistas', contractorFolder, 'Anexos']
                        });
                        updates.bankCertificatePath = cleanUploaded.path;
                    }

                    if (bankExtracted.bankName) updates.bankName = bankExtracted.bankName;
                    if (bankExtracted.accountNumber) updates.accountNumber = bankExtracted.accountNumber;
                    if (bankExtracted.paymentMethod) updates.paymentMethod = bankExtracted.paymentMethod;
                }
            } catch (err) {
                if (err.code === 'PASSWORD_REQUIRED') {
                    Object.assign(contract, updates);
                    await contract.save();

                    return res.status(200).json({
                        requiresPassword: true,
                        docType: 'bankCertificate',
                        invalidPassword: Boolean(req.body.bankCertificatePassword),
                        message: req.body.bankCertificatePassword
                            ? "La contraseña ingresada es incorrecta para el certificado bancario."
                            : (candidates.length > 0
                                ? "El certificado bancario está protegido con contraseña. Intentamos abrirla automáticamente con tu número de cédula pero no coincidió. Por favor ingresa la contraseña para procesarlo con la IA."
                                : "El certificado bancario está protegido con contraseña. Por favor ingresa la contraseña para procesarlo con la IA."),
                        data: contract
                    });
                }
                console.error("No se pudo extraer información del certificado bancario:", err.message);
            }
        }

        Object.assign(contract, updates);
        await contract.save();

        res.json({
            message: 'Documentos anexos procesados y guardados en Google Drive con éxito',
            data: contract,
            extracted: {
                bank: bankExtracted,
                rut: rutExtracted,
                securitySocial: securitySocialExtracted
            }
        });
    } catch (error) {
        console.error('Error uploadAttachments:', error);
        res.status(500).json({ message: 'Error al subir anexos', error: error.message });
    }
};

exports.unlockSecuritySocial = async (req, res) => {
    try {
        const { password, contractId } = req.body;
        if (!password || !password.trim()) {
            return res.status(400).json({ message: 'Por favor ingresa la contraseña de la planilla de seguridad social' });
        }

        const contract = await resolveContract(req.user._id, contractId);
        if (!contract || !contract.securitySocialPath) {
            return res.status(404).json({ message: 'No hay una planilla de seguridad social cargada previamente' });
        }

        const fileBuffer = await storageService.getFileBuffer(contract.securitySocialPath);
        if (!fileBuffer) {
            return res.status(404).json({ message: 'El archivo de la planilla no fue encontrado. Por favor vuelve a subirlo.' });
        }

        try {
            const ssExtracted = await extractSecuritySocialData(fileBuffer, {
                password: password.trim(),
                candidatePasswords: []
            });

            if (ssExtracted?.cleanBuffer) {
                const user = await User.findById(req.user._id);
                const folder = getContractorFolder(contract, user);
                const cleanUploaded = await storageService.saveFile({
                    buffer: ssExtracted.cleanBuffer,
                    filename: `Seguridad_Social_Limpia_${Date.now()}.pdf`,
                    mimetype: 'application/pdf',
                    pathSegments: ['Contratistas', folder, 'Anexos']
                });
                contract.securitySocialPath = cleanUploaded.path;
                await contract.save();
            }

            return res.json({
                success: true,
                message: '¡Planilla de seguridad social desbloqueada y procesada por IA con éxito!',
                data: contract,
                extracted: ssExtracted
            });
        } catch (err) {
            if (err.code === 'PASSWORD_REQUIRED') {
                return res.status(400).json({
                    requiresPassword: true,
                    docType: 'securitySocial',
                    invalidPassword: true,
                    message: 'Contraseña incorrecta. Por favor verifica e intenta nuevamente.'
                });
            }
            return res.status(500).json({
                message: 'Error al procesar la planilla de seguridad social: ' + err.message
            });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error al desbloquear planilla de seguridad social', error: error.message });
    }
};

exports.unlockBankCertificate = async (req, res) => {
    try {
        const { password, contractId } = req.body;
        if (!password || !password.trim()) {
            return res.status(400).json({ message: 'Por favor ingresa la contraseña del certificado bancario' });
        }

        const contract = await resolveContract(req.user._id, contractId);
        if (!contract || !contract.bankCertificatePath) {
            return res.status(404).json({ message: 'No hay un certificado bancario cargado previamente' });
        }

        const fileBuffer = await storageService.getFileBuffer(contract.bankCertificatePath);
        if (!fileBuffer) {
            return res.status(404).json({ message: 'El archivo del certificado bancario no fue encontrado. Por favor vuelve a subirlo.' });
        }

        try {
            console.log("Intentando desbloquear certificado bancario con contraseña ingresada...");
            const bankExtracted = await extractBankCertificateData(fileBuffer, {
                password: password.trim(),
                candidatePasswords: []
            });

            if (bankExtracted) {
                if (bankExtracted.cleanBuffer) {
                    const user = await User.findById(req.user._id);
                    const folder = getContractorFolder(contract, user);
                    const cleanUploaded = await storageService.saveFile({
                        buffer: bankExtracted.cleanBuffer,
                        filename: `Certificado_Bancario_Limpio_${Date.now()}.pdf`,
                        mimetype: 'application/pdf',
                        pathSegments: ['Contratistas', folder, 'Anexos']
                    });
                    contract.bankCertificatePath = cleanUploaded.path;
                }

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
        const { password, contractId } = req.body;
        if (!password || !password.trim()) {
            return res.status(400).json({ message: 'Por favor ingresa la contraseña del RUT' });
        }

        const contract = await resolveContract(req.user._id, contractId);
        if (!contract || !contract.rutPath) {
            return res.status(404).json({ message: 'No hay un RUT cargado previamente' });
        }

        const fileBuffer = await storageService.getFileBuffer(contract.rutPath);
        if (!fileBuffer) {
            return res.status(404).json({ message: 'El archivo del RUT no fue encontrado. Por favor vuelve a subirlo.' });
        }

        try {
            console.log("Intentando desbloquear RUT con contraseña ingresada...");
            const rutExtracted = await extractRutData(fileBuffer, {
                password: password.trim(),
                candidatePasswords: []
            });

            if (rutExtracted) {
                if (rutExtracted.cleanBuffer) {
                    const user = await User.findById(req.user._id);
                    const folder = getContractorFolder(contract, user);
                    const cleanUploaded = await storageService.saveFile({
                        buffer: rutExtracted.cleanBuffer,
                        filename: `RUT_Limpio_${Date.now()}.pdf`,
                        mimetype: 'application/pdf',
                        pathSegments: ['Contratistas', folder, 'Anexos']
                    });
                    contract.rutPath = cleanUploaded.path;
                }

                if (rutExtracted.contractorAddress) contract.contractorAddress = rutExtracted.contractorAddress;
                if (rutExtracted.idCity) contract.idCity = rutExtracted.idCity;
                if (typeof rutExtracted.isTaxFiler === 'boolean') contract.isTaxFiler = rutExtracted.isTaxFiler;
                if (rutExtracted.contractorPhone && !contract.contractorPhone) contract.contractorPhone = rutExtracted.contractorPhone;
                if (rutExtracted.contractorEmail && !contract.contractorEmail) contract.contractorEmail = rutExtracted.contractorEmail;
                await contract.save();
            }

            return res.json({
                success: true,
                message: '¡RUT desbloqueado y procesado por IA con éxito! Datos del RUT actualizados.',
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
        const contractId = req.body.contractId || req.query.contractId;
        let contract = await resolveContract(req.user._id, contractId);
        if (!contract) {
            contract = new Contract({ user: req.user._id });
        }

        const allowedFields = [
            'entityName', 'contractAlias', 'status',
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

exports.uploadRp = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba el documento del Registro Presupuestal (RP)' });
        }

        const contractId = req.body.contractId || req.query.contractId;
        let contract = await resolveContract(req.user._id, contractId);
        if (!contract) {
            return res.status(400).json({ message: 'Primero debe subir el contrato base antes de cargar el RP' });
        }

        const user = await User.findById(req.user._id);
        const folder = getContractorFolder(contract, user);
        const fileBuffer = req.file.buffer || (req.file.path && fs.existsSync(req.file.path) ? fs.readFileSync(req.file.path) : null);

        const uploaded = await storageService.saveFile({
            buffer: fileBuffer,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            pathSegments: ['Contratistas', folder, 'Anexos']
        });
        contract.rpPath = uploaded.path;

        // Extract RP data with Gemini AI
        const rpData = await extractRpData(fileBuffer, {
            filename: req.file.originalname,
            mimetype: req.file.mimetype
        });

        if (rpData.rpNumber)  contract.rp    = rpData.rpNumber;
        if (rpData.cdpNumber) contract.cdp   = rpData.cdpNumber;
        if (rpData.rubro)     contract.rubro  = rpData.rubro;
        if (rpData.rpDate)    contract.rpDate = rpData.rpDate;

        await contract.save();

        res.json({
            message: 'Registro Presupuestal procesado y respaldado en Google Drive con éxito',
            extracted: rpData,
            data: contract
        });
    } catch (error) {
        console.error('Error uploadRp:', error);
        res.status(500).json({ message: 'Error al procesar el RP', error: error.message });
    }
};

exports.uploadAdditionContract = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba el documento modificatorio de la adición' });
        }

        const contractId = req.body.contractId || req.query.contractId;
        let contract = await resolveContract(req.user._id, contractId);

        if (!contract) {
            return res.status(400).json({ message: 'Primero debe configurar su contrato base antes de cargar una adición' });
        }

        const user = await User.findById(req.user._id);
        const folder = getContractorFolder(contract, user);
        const fileBuffer = req.file.buffer || (req.file.path && fs.existsSync(req.file.path) ? fs.readFileSync(req.file.path) : null);

        const uploaded = await storageService.saveFile({
            buffer: fileBuffer,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            pathSegments: ['Contratistas', folder, 'Adiciones']
        });

        // Extract data with Gemini
        const extractedData = await extractAdditionContractData(fileBuffer, {
            filename: req.file.originalname,
            mimetype: req.file.mimetype
        });

        Object.assign(contract, extractedData, { 
            hasAddition: true,
            additionDocumentPath: uploaded.path 
        });
        await contract.save();

        res.json({
            message: 'Modificatorio de adición procesado y respaldado en Google Drive con éxito',
            data: contract
        });
    } catch (error) {
        console.error('Error uploadAdditionContract:', error);
        res.status(500).json({ message: 'Error al procesar la adición', error: error.message });
    }
};

exports.uploadAdditionRp = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba el documento del Registro Presupuestal (RP) de la adición' });
        }

        const contractId = req.body.contractId || req.query.contractId;
        let contract = await resolveContract(req.user._id, contractId);
        if (!contract) {
            return res.status(400).json({ message: 'Primero debe configurar su contrato base antes de cargar el RP de adición' });
        }

        const user = await User.findById(req.user._id);
        const folder = getContractorFolder(contract, user);
        const fileBuffer = req.file.buffer || (req.file.path && fs.existsSync(req.file.path) ? fs.readFileSync(req.file.path) : null);

        const uploaded = await storageService.saveFile({
            buffer: fileBuffer,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            pathSegments: ['Contratistas', folder, 'Adiciones']
        });
        contract.additionRpPath = uploaded.path;

        // Extract RP data with Gemini AI
        const rpData = await extractRpData(fileBuffer, {
            filename: req.file.originalname,
            mimetype: req.file.mimetype
        });

        if (rpData.rpNumber)  contract.additionRp    = rpData.rpNumber;
        if (rpData.cdpNumber) contract.additionCdp   = rpData.cdpNumber;
        if (rpData.rubro)     contract.additionRubro  = rpData.rubro;

        await contract.save();

        res.json({
            message: 'Registro Presupuestal de la adición procesado y guardado en Google Drive con éxito',
            extracted: rpData,
            data: contract
        });
    } catch (error) {
        console.error('Error uploadAdditionRp:', error);
        res.status(500).json({ message: 'Error al procesar el RP de la adición', error: error.message });
    }
};

exports.uploadActaInicio = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor suba el documento del Acta de Inicio' });
        }

        const contractId = req.body.contractId || req.query.contractId;
        let contract = await resolveContract(req.user._id, contractId);
        if (!contract) {
            return res.status(400).json({ message: 'Primero debe configurar su contrato base antes de cargar el Acta de Inicio' });
        }

        const user = await User.findById(req.user._id);
        const folder = getContractorFolder(contract, user);
        const fileBuffer = req.file.buffer || (req.file.path && fs.existsSync(req.file.path) ? fs.readFileSync(req.file.path) : null);

        const uploaded = await storageService.saveFile({
            buffer: fileBuffer,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            pathSegments: ['Contratistas', folder, 'Anexos']
        });
        contract.actaInicioPath = uploaded.path;

        const actaData = await extractActaInicioData(fileBuffer, {
            filename: req.file.originalname,
            mimetype: req.file.mimetype
        });

        if (actaData.startDate) contract.startDate = actaData.startDate;
        if (actaData.endDate) contract.endDate = actaData.endDate;
        if (actaData.contractNumber && !contract.contractNumber) contract.contractNumber = actaData.contractNumber;
        if (actaData.supervisorName && !contract.supervisorName) contract.supervisorName = actaData.supervisorName;
        if (actaData.initialDurationMonths) contract.initialDurationMonths = Number(actaData.initialDurationMonths);
        if (actaData.executionTerm && !contract.executionTerm) contract.executionTerm = actaData.executionTerm;

        await contract.save();

        res.json({
            message: 'Acta de Inicio procesada y respaldada en Google Drive con éxito',
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
        const contractId = req.query.contractId;
        const contract = await resolveContract(req.user._id, contractId);
        if (!contract) return res.json({ needsReminder: false });
        const status = await checkContractEvidenceStatus(contract, req.user);
        res.json(status || { needsReminder: false });
    } catch (error) {
        console.error('Error en getEvidenceReminderStatus:', error);
        res.status(500).json({ message: 'Error al verificar recordatorios', error: error.message });
    }
};

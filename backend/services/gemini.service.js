const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const pdf = require("pdf-parse");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.extractContractData = async (filePath) => {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        let text = "";
        let useMultimodal = false;

        if (filePath.endsWith('.pdf')) {
            try {
                const data = await pdf(dataBuffer);
                text = data.text;
                if (!text || text.trim().length < 150) {
                    useMultimodal = true;
                }
            } catch (err) {
                console.warn("pdf-parse falló, usando Gemini multimodal OCR:", err.message);
                useMultimodal = true;
            }
        } else {
            text = dataBuffer.toString();
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Analiza el siguiente texto de un contrato (minuta) y extrae la información en formato JSON puro (sin markdown). 
            Extrae SOLO los campos que encuentres. Si no encuentras un dato, déjalo como string vacío "".
            
            Campos requeridos:
            - contractorName (Nombre completo o Razón Social del contratista)
            - idNumber (Número de identificación, Cédula o NIT)
            - contractType (Clase o tipo de contrato, ej: Prestación de Servicios Profesionales)
            - contractNumber (Número de contrato, ej: 042-2026)
            - startDate (Fecha de firma o de inicio)
            - endDate (Fecha de terminación o plazo de ejecución)
            - cdp (Número de Certificado de Disponibilidad Presupuestal - CDP, si aparece)
            - rp (Número de Registro Presupuestal - RP, si aparece)
            - rubro (Código o Rubro Presupuestal, si aparece)
            - totalValue (Valor numérico total del contrato, ej: 12000000)
            - totalValueWord (El valor total del contrato expresado completamente en letras, ej: "DOCE MILLONES DE PESOS M/CTE")
            - monthlyValue (Valor numérico del pago mensual, ej: 2000000)
            - monthlyValueWord (El valor mensual del pago expresado completamente en letras, ej: "DOS MILLONES DE PESOS M/CTE")
            - bankName (Nombre de la entidad bancaria)
            - accountNumber (Número de cuenta bancaria)
            - paymentMethod (Forma de pago, ej: Transferencia electrónica, consignación)
            - contractObject (Objeto del contrato, descripción general de las actividades o servicios prestados)
            - supervisorName (Nombre del supervisor asignado al contrato, suele aparecer al final o en las cláusulas de supervisión)
            - supervisorDependency (Dependencia, cargo, secretaría o área a la que pertenece el supervisor o que supervisa el contrato, ej: Secretaría de Planeación. Si no se especifica, intenta deducirlo o déjalo vacío "")
            - contractorAddress (Dirección de domicilio, residencia o notificación del contratista, ej: Calle 15 No 14-22. Búscala en la sección de datos o firmas del contratista. Si no se especifica, déjala vacía "")
            - contractorPhone (Número de teléfono o celular del contratista. Búscalo en los datos de notificación o firmas. Si no se especifica, déjalo vacío "")
            - cutoffDay (Día numérico del mes en que se hace la fecha de corte, ej. 25 o 15. Si no se especifica explícitamente, pon 25 como valor numérico por defecto)
            - activities (Un arreglo de strings con cada una de las obligaciones específicas o actividades detalladas a desarrollar del contratista que aparezcan en las cláusulas de obligaciones. Deben ser frases descriptivas limpias sin numeración al inicio, ej: "Apoyar la implementación del sistema..." en lugar de "1. Apoyar la implementación del sistema...")
        `;

        let result;
        if (useMultimodal && filePath.endsWith('.pdf')) {
            console.log("Detectado PDF escaneado (imagen). Usando modo multimodal de Gemini para OCR...");
            const pdfPart = {
                inlineData: {
                    data: dataBuffer.toString("base64"),
                    mimeType: "application/pdf"
                }
            };
            result = await model.generateContent([prompt, pdfPart]);
        } else {
            result = await model.generateContent(`${prompt}\n\nTexto del contrato:\n${text.substring(0, 30000)}`);
        }

        const response = await result.response;
        const jsonText = response.text().replace(/```json|```/g, "").trim();
        
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error en Gemini Service:", error);
        throw new Error("No se pudo procesar el documento con IA");
    }
};

exports.extractRpData = async (filePath) => {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        let text = "";
        let useMultimodal = false;

        if (filePath.endsWith('.pdf')) {
            try {
                const data = await pdf(dataBuffer);
                text = data.text;
                if (!text || text.trim().length < 100) {
                    useMultimodal = true;
                }
            } catch (err) {
                console.warn("pdf-parse falló, usando Gemini multimodal OCR para RP:", err.message);
                useMultimodal = true;
            }
        } else {
            text = dataBuffer.toString();
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Analiza el siguiente texto de un documento de Registro Presupuestal (RP) y extrae la información en formato JSON puro (sin markdown). 
            Extrae SOLO los campos que encuentres. Si no encuentras un dato, déjalo como string vacío "".
            
            Campos requeridos:
            - rpNumber (Número de Registro Presupuestal - RP, ej: 00762)
            - cdpNumber (Número de Certificado de Disponibilidad Presupuestal - CDP)
            - rubro (Código o Rubro presupuestal o partida de presupuesto asignada, ej: 2.1.2.02.01.003.02)
            - rpDate (Fecha de expedición o registro del RP)
        `;

        let result;
        if (useMultimodal && filePath.endsWith('.pdf')) {
            const pdfPart = {
                inlineData: {
                    data: dataBuffer.toString("base64"),
                    mimeType: "application/pdf"
                }
            };
            result = await model.generateContent([prompt, pdfPart]);
        } else {
            result = await model.generateContent(`${prompt}\n\nTexto del RP:\n${text.substring(0, 20000)}`);
        }

        const response = await result.response;
        const jsonText = response.text().replace(/```json|```/g, "").trim();
        
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error en extractRpData:", error);
        throw new Error("No se pudo procesar el RP con IA");
    }
};

exports.extractAdditionContractData = async (filePath) => {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        let text = "";
        let useMultimodal = false;

        if (filePath.endsWith('.pdf')) {
            try {
                const data = await pdf(dataBuffer);
                text = data.text;
                if (!text || text.trim().length < 150) {
                    useMultimodal = true;
                }
            } catch (err) {
                console.warn("pdf-parse falló en modificatorio, usando Gemini multimodal OCR:", err.message);
                useMultimodal = true;
            }
        } else {
            text = dataBuffer.toString();
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Analiza el siguiente texto de un documento modificatorio (adición y/o prórroga de contrato) y extrae la información relevante en formato JSON puro (sin markdown). 
            Extrae SOLO los campos que encuentres. Si no encuentras un dato, déjalo como string vacío "".
            
            Campos requeridos:
            - additionValue (Valor numérico total de la adición, ej: 5600000)
            - additionValueWord (El valor total de la adición expresado en letras, ej: "CINCO MILLONES SEISCIENTOS MIL PESOS M/CTE")
            - additionStartDate (Fecha de inicio de la adición, ej: "15 de mayo de 2026")
            - additionEndDate (Fecha de terminación o plazo final de la adición, ej: "14 de julio de 2026")
            - additionCdp (Número de Certificado de Disponibilidad Presupuestal - CDP de la adición)
            - additionRp (Número de Registro Presupuestal - RP de la adición, si aparece)
            - additionRubro (Código o Rubro Presupuestal de la adición)
            - additionDuration (Plazo o duración de la adición en meses, ej: "DOS (02) MESES")
        `;

        let result;
        if (useMultimodal && filePath.endsWith('.pdf')) {
            console.log("Detectado modificatorio escaneado. Usando modo multimodal de Gemini para OCR...");
            const pdfPart = {
                inlineData: {
                    data: dataBuffer.toString("base64"),
                    mimeType: "application/pdf"
                }
            };
            result = await model.generateContent([prompt, pdfPart]);
        } else {
            result = await model.generateContent(`${prompt}\n\nTexto del modificatorio:\n${text.substring(0, 30000)}`);
        }

        const response = await result.response;
        const jsonText = response.text().replace(/```json|```/g, "").trim();
        
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error en extractAdditionContractData:", error);
        throw new Error("No se pudo procesar la adición con IA");
    }
};

exports.extractBankCertificateData = async (filePath) => {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        let text = "";
        let useMultimodal = false;

        if (filePath.endsWith('.pdf')) {
            try {
                const data = await pdf(dataBuffer);
                text = data.text;
                if (!text || text.trim().length < 50) {
                    useMultimodal = true;
                }
            } catch (err) {
                console.warn("pdf-parse falló en certificado bancario, usando Gemini multimodal OCR:", err.message);
                useMultimodal = true;
            }
        } else {
            // It might be an image (jpg/png)
            useMultimodal = true;
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Analiza el siguiente documento que corresponde a una Certificación Bancaria o Certificado de Cuenta y extrae la información en formato JSON puro (sin markdown). 
            Extrae SOLO los campos que encuentres. Si no encuentras un dato, déjalo como string vacío "".
            
            Campos requeridos:
            - bankName (Nombre de la entidad bancaria en mayúsculas, ej: BANCOLOMBIA, DAVIVIENDA, BANCO DE BOGOTA, BANCO DE OCCIDENTE)
            - accountNumber (Número de la cuenta bancaria, ej: 98765432109)
            - paymentMethod (El tipo de cuenta en formato limpio, ej: "Ahorros" o "Corriente")
        `;

        let result;
        const isImage = filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg');
        if ((useMultimodal && filePath.endsWith('.pdf')) || isImage) {
            console.log("Procesando certificado bancario escaneado o imagen. Usando modo multimodal de Gemini...");
            const mimeType = isImage ? `image/${filePath.split('.').pop()}` : "application/pdf";
            const filePart = {
                inlineData: {
                    data: dataBuffer.toString("base64"),
                    mimeType: mimeType
                }
            };
            result = await model.generateContent([prompt, filePart]);
        } else {
            result = await model.generateContent(`${prompt}\n\nTexto de la certificación bancaria:\n${text.substring(0, 10000)}`);
        }

        const response = await result.response;
        const jsonText = response.text().replace(/```json|```/g, "").trim();
        
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error en extractBankCertificateData:", error);
        throw new Error("No se pudo procesar el certificado bancario con IA");
    }
};

exports.extractSecuritySocialData = async (filePath) => {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        let text = "";
        let useMultimodal = false;

        if (filePath.endsWith('.pdf')) {
            try {
                const data = await pdf(dataBuffer);
                text = data.text;
                if (!text || text.trim().length < 150) {
                    useMultimodal = true;
                }
            } catch (err) {
                console.warn("pdf-parse falló en planilla SS, usando Gemini multimodal OCR:", err.message);
                useMultimodal = true;
            }
        } else {
            useMultimodal = true;
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Analiza la siguiente planilla de pago de seguridad social (PILA) o aportes y extrae la información en formato JSON puro (sin markdown). 
            Extrae SOLO los campos que encuentres. Si no encuentras un dato, déjalo como string vacío "" o 0 para campos numéricos.
            
            Campos requeridos:
            - operator (El nombre del operador de la planilla, ej: SIMPLE, SOI, miplanilla, aportesenlinea, en mayúsculas)
            - planillaNumber (Número de planilla de aportes, suele ser un número largo de 9 o 10 dígitos)
            - totalPaid (Número entero. El valor total pagado en la planilla, ej: 585200)
            - saludPaid (Número entero. El valor pagado al subsistema de salud, ej: 180000)
            - pensionPaid (Número entero. El valor pagado al subsistema de pensiones, ej: 240000)
            - arlPaid (Número entero. El valor pagado a riesgos laborales ARL, ej: 25200)
            - period (Periodo de cotización de los aportes en texto legible, ej: "Mayo de 2026", "Abril de 2026")
        `;

        let result;
        const isImage = filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg');
        if ((useMultimodal && filePath.endsWith('.pdf')) || isImage) {
            console.log("Procesando planilla de seguridad social escaneada o imagen. Usando modo multimodal de Gemini...");
            const mimeType = isImage ? `image/${filePath.split('.').pop()}` : "application/pdf";
            const filePart = {
                inlineData: {
                    data: dataBuffer.toString("base64"),
                    mimeType: mimeType
                }
            };
            result = await model.generateContent([prompt, filePart]);
        } else {
            result = await model.generateContent(`${prompt}\n\nTexto de la planilla:\n${text.substring(0, 30000)}`);
        }

        const response = await result.response;
        const jsonText = response.text().replace(/```json|```/g, "").trim();
        
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error en extractSecuritySocialData:", error);
        throw new Error("No se pudo procesar la planilla de seguridad social con IA");
    }
};


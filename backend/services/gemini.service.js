const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const pdf = require("pdf-parse");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateAIContent = async (contents) => {
    const candidateModels = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash"];
    let lastError = null;

    for (const modelName of candidateModels) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            return await model.generateContent(contents);
        } catch (err) {
            console.warn(`Aviso: Intento con ${modelName} falló (${err.message}). Reintentando con siguiente modelo...`);
            lastError = err;
        }
    }
    throw lastError;
};

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

        const prompt = `
            Analiza el siguiente texto de un contrato (minuta) y extrae la información en formato JSON puro (sin markdown). 
            Extrae SOLO los campos que encuentres. Si no encuentras un dato, déjalo como string vacío "".
            
            Campos requeridos:
            - contractorName (Nombre completo o Razón Social del contratista)
            - idNumber (Número de identificación, Cédula o NIT)
            - contractType (Clase o tipo de contrato, ej: Prestación de Servicios de Apoyo a la Gestión o Profesionales)
            - contractNumber (Número de contrato, ej: 042-2026 o TIC-CD-2026-055 o CO1.PCCNTR.9868582)
            - startDate (Fecha oficial de inicio de ejecución en formato YYYY-MM-DD. ADVERTENCIA: NO tomes la fecha de expedición del registro presupuestal RP, ni de expedición del CDP, ni la fecha de hoy. Si la minuta estipula que el plazo inicia con el Acta de Inicio o con la configuración en SECOP II y NO incluye una fecha exacta de calendario, déjalo como string vacío "")
            - endDate (Fecha de terminación o plazo de ejecución expresado en la minuta, ej: "CIENTO QUINCE (115) DIAS CALENDARIO...")
            - periodType (Analiza con cuidado las cláusulas de "VALOR Y FORMA DE PAGO" y "PLAZO DE EJECUCIÓN". Si dice que los pagos se realizarán cada "treinta (30) días calendario" o "30 días calendario", debe ser exactamente "30_dias". Si dice pagos por mensualidades, mes vencido, mensual o mes cumplido, debe ser exactamente "mes_cumplido". Solo debe ser uno de estos dos valores exactos: "30_dias" o "mes_cumplido")
            - initialDurationMonths (Número entero de periodos de cobro o meses pactados. Ej: si dice 4 meses, pon 4; si dice 115 días calendario distribuidos en 4 pagos [3 de 30 días y 1 de 25 días], pon 4)
            - cdp (Número de Certificado de Disponibilidad Presupuestal - CDP, si aparece)
            - rp (Número de Registro Presupuestal - RP, si aparece)
            - rubro (Código o Rubro Presupuestal, si aparece)
            - totalValue (Valor numérico total del contrato, ej: 11500000)
            - totalValueWord (El valor total del contrato expresado completamente en letras, ej: "ONCE MILLONES QUINIENTOS MIL PESOS M/CTE")
            - monthlyValue (Valor numérico del pago mensual o cuota regular pactada, ej: 3000000)
            - monthlyValueWord (El valor mensual del pago expresado completamente en letras, ej: "TRES MILLONES DE PESOS M/CTE")
            - bankName (Nombre de la entidad bancaria)
            - accountNumber (Número de cuenta bancaria)
            - paymentMethod (Forma de pago, ej: Ahorros, Corriente, transferencia electrónica)
            - contractObject (Objeto del contrato, descripción general de las actividades o servicios prestados)
            - supervisorName (Nombre del supervisor asignado al contrato, suele aparecer al final o en las cláusulas de supervisión)
            - supervisorDependency (Dependencia, cargo, secretaría o área a la que pertenece el supervisor o que supervisa el contrato, ej: Secretaría de Tecnologías de la Información y las Comunicaciones. Si no se especifica, intenta deducirlo o déjalo vacío "")
            - contractorAddress (Dirección de domicilio, residencia o notificación del contratista. Si no se especifica, déjala vacía "")
            - contractorPhone (Número de teléfono o celular del contratista. Si no se especifica, déjalo vacío "")
            - cutoffDay (Día numérico del mes en que se hace la fecha de corte, ej. 25 o 30. Si el contrato dice 30 días calendario pon 30, de lo contrario si no se especifica explícitamente pon 25)
            - activities (Un arreglo de strings con ÚNICAMENTE las obligaciones ESPECÍFICAS del contratista que aparezcan bajo la cláusula de "Obligaciones Específicas" o numeral "2.2". REGLA OBLIGATORIA: NO incluyas bajo ninguna circunstancia obligaciones generales como: presentar informes mensuales al supervisor, realizar aportes al sistema de seguridad social, conocer o implementar MIPG, obrar con lealtad y buena fe, afiliarse a riesgos laborales SG-SST, ni entregar inventario documental o archivos al finalizar. Deben ser EXCLUSIVAMENTE las obligaciones específicas técnicas que el contratista debe ejecutar y evidenciar. Frases descriptivas limpias sin numeración al inicio, ej: "Realizar evaluaciones técnicas de equipos..." en lugar de "1. Realizar...")
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
            result = await generateAIContent([prompt, pdfPart]);
        } else {
            result = await generateAIContent(`${prompt}\n\nTexto del contrato:\n${text.substring(0, 30000)}`);
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
            result = await generateAIContent([prompt, pdfPart]);
        } else {
            result = await generateAIContent(`${prompt}\n\nTexto del RP:\n${text.substring(0, 20000)}`);
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
            result = await generateAIContent([prompt, pdfPart]);
        } else {
            result = await generateAIContent(`${prompt}\n\nTexto del modificatorio:\n${text.substring(0, 30000)}`);
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
            result = await generateAIContent([prompt, filePart]);
        } else {
            result = await generateAIContent(`${prompt}\n\nTexto de la certificación bancaria:\n${text.substring(0, 10000)}`);
        }

        const response = await result.response;
        const jsonText = response.text().replace(/```json|```/g, "").trim();
        
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error en extractBankCertificateData:", error);
        if (error.message && (error.message.includes('password') || error.message.includes('Password') || error.message.includes('no pages'))) {
            throw new Error("El certificado bancario parece tener clave o estar protegido. Por favor sube una imagen o un PDF sin clave.");
        }
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
            result = await generateAIContent([prompt, filePart]);
        } else {
            result = await generateAIContent(`${prompt}\n\nTexto de la planilla:\n${text.substring(0, 30000)}`);
        }

        const response = await result.response;
        const jsonText = response.text().replace(/```json|```/g, "").trim();
        
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error en extractSecuritySocialData:", error);
        throw new Error("No se pudo procesar la planilla de seguridad social con IA");
    }
};

exports.extractActaInicioData = async (filePath) => {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        let text = "";
        let useMultimodal = false;

        if (filePath.endsWith('.pdf')) {
            try {
                const data = await pdf(dataBuffer);
                text = data.text;
                if (!text || text.trim().length < 80) {
                    useMultimodal = true;
                }
            } catch (err) {
                console.warn("pdf-parse falló en acta de inicio, usando Gemini multimodal OCR:", err.message);
                useMultimodal = true;
            }
        } else {
            useMultimodal = true;
        }

        const prompt = `
            Analiza el siguiente documento correspondiente a un Acta de Inicio de contrato o pantallazo de aprobación/ejecución de SECOP II (ej: "VER CONTRATO", "Fecha de inicio del contrato") y extrae la información en formato JSON puro (sin markdown).
            Extrae SOLO los campos que encuentres. Si no encuentras un dato, déjalo como string vacío "".

            Campos requeridos:
            - startDate (Fecha oficial de inicio de ejecución del contrato. Formato obligatorio: YYYY-MM-DD, ej. "2026-08-28" o "2026-01-15". Si es un pantallazo de SECOP II, busca el campo exacto "Fecha de inicio del contrato" ej: "28/08/2026" y conviértelo a "2026-08-28". Si es un acta física de inicio, busca la fecha de suscripción o inicio acordada.)
            - endDate (Fecha oficial de terminación del contrato en formato YYYY-MM-DD, ej. "2026-12-20" o "2026-05-14". Si es de SECOP II, busca el campo "Fecha de terminación del contrato".)
            - contractNumber (Número de contrato relacionado, ej: 014-2026 o TIC-CD-2026-055 o CO1.PCCNTR.9868582)
            - supervisorName (Nombre del supervisor que aprueba o firma el acta o figura en la entidad estatal)
            - initialDurationMonths (Plazo en meses si aparece especificado como número entero ej: 4, o la duración en meses calculada a partir de los días o fechas)
        `;

        let result;
        const isImage = filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg');
        if ((useMultimodal && filePath.endsWith('.pdf')) || isImage) {
            const mimeType = isImage ? `image/${filePath.split('.').pop()}` : "application/pdf";
            const filePart = {
                inlineData: {
                    data: dataBuffer.toString("base64"),
                    mimeType: mimeType
                }
            };
            result = await generateAIContent([prompt, filePart]);
        } else {
            result = await generateAIContent(`${prompt}\n\nTexto del Acta de Inicio:\n${text.substring(0, 20000)}`);
        }

        const response = await result.response;
        const jsonText = response.text().replace(/```json|```/g, "").trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error en extractActaInicioData:", error);
        throw new Error("No se pudo procesar el Acta de Inicio con IA");
    }
};

exports.extractRutData = async (filePath) => {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        let text = "";
        let useMultimodal = false;

        if (filePath.endsWith('.pdf')) {
            try {
                const data = await pdf(dataBuffer);
                text = data.text;
                if (!text || text.trim().length < 80) {
                    useMultimodal = true;
                }
            } catch (err) {
                console.warn("pdf-parse falló en RUT, usando Gemini multimodal OCR:", err.message);
                useMultimodal = true;
            }
        } else {
            useMultimodal = true;
        }

        const prompt = `
            Analiza el siguiente documento correspondiente al RUT (Registro Único Tributario de la DIAN) de Colombia y extrae la información en formato JSON puro (sin markdown).
            Extrae SOLO los campos que encuentres. Si no encuentras un dato, déjalo como string vacío "".

            Campos requeridos:
            - idNumber (Número de identificación o Cédula o NIT sin dígito de verificación)
            - contractorName (Nombres y apellidos completos o razón social)
            - contractorAddress (Dirección principal de domicilio o notificación fiscal)
            - contractorPhone (Número de teléfono o celular registrado)
            - contractorEmail (Correo electrónico registrado)
            - idCity (Municipio o ciudad de domicilio, ej: Armenia)
            - isTaxFiler (Booleano: true si en la casilla de responsabilidades tiene el código 05 'Impuesto sobre la renta', false si no)
        `;

        let result;
        const isImage = filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg');
        if ((useMultimodal && filePath.endsWith('.pdf')) || isImage) {
            const mimeType = isImage ? `image/${filePath.split('.').pop()}` : "application/pdf";
            const filePart = {
                inlineData: {
                    data: dataBuffer.toString("base64"),
                    mimeType: mimeType
                }
            };
            result = await generateAIContent([prompt, filePart]);
        } else {
            result = await generateAIContent(`${prompt}\n\nTexto del RUT:\n${text.substring(0, 20000)}`);
        }

        const response = await result.response;
        const jsonText = response.text().replace(/```json|```/g, "").trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error en extractRutData:", error);
        throw new Error("No se pudo procesar el RUT con IA");
    }
};

exports.improveEvidenceText = async (arg1, arg2, arg3) => {
    try {
        let rawText = '';
        let obligationText = '';
        let contractorName = '';
        if (typeof arg1 === 'object' && arg1 !== null) {
            rawText = arg1.rawText || '';
            obligationText = arg1.obligationText || '';
            contractorName = arg1.contractorName || '';
        } else {
            rawText = arg1 || '';
            obligationText = arg2 || '';
            contractorName = arg3 || '';
        }
        if (!rawText || !rawText.trim()) return rawText;

        const targetWords = Math.floor(Math.random() * (44 - 34 + 1)) + 34;

        const prompt = `
            Eres un experto redactor de informes técnicos y cuentas de cobro para contratistas de entidades públicas en Colombia.
            El contratista ha escrito la siguiente idea o descripción breve de las actividades realizadas como evidencia:
            "${rawText.trim()}"

            Esta actividad corresponde a la siguiente obligación específica del contrato:
            "${(obligationText || '').trim()}"

            Tu objetivo:
            Toma la idea del contratista como base de contexto y redacta una descripción técnica, profesional, formal y descriptiva de la labor ejecutada.
            
            REGLAS ESTRICTAS:
            1. Longitud obligatoria: EXACTAMENTE entre 30 y 48 palabras (cuenta las palabras, no debes superar las 50 palabras bajo ninguna circunstancia).
            2. Redacta en estilo formal técnico para informe mensual de actividades (ej: "Se llevó a cabo...", "Se realizó...", "Ejecución de actividades de...", "Atención y resolución de...").
            3. Debe ser creíble y directamente alineada con la obligación contractual indicada.
            4. Entrega ÚNICAMENTE el texto redactado en texto plano, sin comillas, sin viñetas, sin introducciones ("Aquí está...") ni comentarios adicionales.
        `;

        const result = await generateAIContent(prompt);
        const response = await result.response;
        let improved = response.text().trim().replace(/^["']|["']$/g, '');

        let words = improved.split(/\s+/).filter(Boolean);
        if (words.length > 50) {
            let trimmed = words.slice(0, 45).join(' ');
            trimmed = trimmed.replace(/[,;:]$/, '');
            if (!/[.!?]$/.test(trimmed)) trimmed += '.';
            improved = trimmed;
        }

        return improved;
    } catch (error) {
        console.error("Error en improveEvidenceText:", error);
        return rawText;
    }
};



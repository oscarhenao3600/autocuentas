const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const { parsePdfText, unlockPdfWithCandidates } = require("../utils/pdf.utils");
const { formatRubroPresupuestal } = require("../utils/period.utils");
const storageService = require("./storage.service");
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

/**
 * Resolves an input which can be a Buffer, a Drive ID, a Drive path, or a local file path
 */
async function resolveInputBuffer(input, options = {}) {
    let buffer = null;
    let filename = options.filename || 'documento.pdf';

    if (Buffer.isBuffer(input)) {
        buffer = input;
    } else if (typeof input === 'string') {
        filename = options.filename || path.basename(input);
        buffer = await storageService.getFileBuffer(input);
    }

    if (!buffer) {
        throw new Error(`No se pudo cargar el archivo para procesamiento con IA: ${input}`);
    }

    const lower = filename.toLowerCase();
    const isPdf = lower.endsWith('.pdf') || options.mimetype === 'application/pdf';
    const isImage = ['.png', '.jpg', '.jpeg', '.webp'].some(ext => lower.endsWith(ext)) || (options.mimetype && options.mimetype.startsWith('image/'));

    return { buffer, filename, isPdf, isImage };
}

exports.extractContractData = async (filePath, options = {}) => {
    try {
        const { buffer: dataBuffer, isPdf } = await resolveInputBuffer(filePath, options);
        let text = "";
        let useMultimodal = false;

        if (isPdf) {
            try {
                text = await parsePdfText(dataBuffer);
                if (!text || text.trim().length < 150) {
                    useMultimodal = true;
                }
            } catch (err) {
                console.warn("Extracción de texto PDF falló, usando Gemini multimodal OCR:", err.message);
                useMultimodal = true;
            }
        } else {
            text = dataBuffer.toString();
        }

        const prompt = `
            Analiza el siguiente texto de un contrato (minuta) y extrae la información en formato JSON puro (sin markdown). 
            Extrae SOLO los campos que encuentres. Si no encuentras un dato, déjalo como string vacío "".
            
            Campos requeridos:
            - entityName (Nombre de la entidad territorial, alcaldía o gobernación contratante, ej: "Alcaldía de Armenia", "Gobernación del Quindío", "Alcaldía de Pereira")
            - contractorName (Nombre completo o Razón Social del contratista)
            - idNumber (Número de identificación, Cédula o NIT)
            - contractType (Clase o tipo de contrato, ej: Prestación de Servicios de Apoyo a la Gestión o Profesionales)
            - contractNumber (Número de contrato, ej: 042-2026 o TIC-CD-2026-055 o CO1.PCCNTR.9868582)
            - startDate (Fecha oficial de inicio de ejecución en formato YYYY-MM-DD. ADVERTENCIA: NO tomes la fecha de expedición del registro presupuestal RP, ni de expedición del CDP, ni la fecha de hoy. Si la minuta estipula que el plazo inicia con el Acta de Inicio o con la configuración en SECOP II y NO incluye una fecha exacta de calendario, déjalo como string vacío "")
            - endDate (Fecha de terminación o plazo de ejecución expresado en la minuta, ej: "2026-12-20" o fecha calculada. Si no hay fecha exacta de calendario, déjalo vacío "")
            - executionTerm (Texto literal completo del plazo de ejecución exactamente como aparece en la cláusula o campo de "PLAZO DE EJECUCIÓN" de la minuta, ej: "CIENTO QUINCE (115) DIAS CALENDARIO CONTADOS A PARTIR DE LA CONFIGURACIÓN DEL INICIO EN LA PLATAFORMA SECOP II." o "115 DÍAS CALENDARIO" o "CUATRO (04) MESES")
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
        if (useMultimodal && isPdf) {
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

exports.extractRpData = async (filePath, options = {}) => {
    try {
        const { buffer: dataBuffer, isPdf } = await resolveInputBuffer(filePath, options);
        let text = "";
        let useMultimodal = false;

        if (isPdf) {
            try {
                text = await parsePdfText(dataBuffer);
                if (!text || text.trim().length < 100) {
                    useMultimodal = true;
                }
            } catch (err) {
                console.warn("Extracción de texto RP falló, usando Gemini multimodal OCR:", err.message);
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
            - rubro (Código completo del Rubro Presupuestal estructurado con su fuente de financiación en formato exacto 'RUBRO - FUENTE', ej: '2.3.2.02.02.009.4599007.077 - 001'. Si en el RP aparece '2.3.2.02.02.009.4599007.077 ... 001 - RECURSOS PROPIOS', extrae y unifica el código del rubro y el código de la fuente como '2.3.2.02.02.009.4599007.077 - 001')
            - rubroCodigo (El código numérico principal del rubro sin la fuente, ej: '2.3.2.02.02.009.4599007.077')
            - fuenteFinanciacion (Texto de la fuente de financiación si figura, ej: '001 - RECURSOS PROPIOS')
            - fuenteCodigo (Código numérico de la fuente de financiación, ej: '001')
            - rubroNombre (La descripción o nombre del rubro o proyecto, ej: 'ARMENIA VIVE TIC: HACIA UN TERRITOR')
            - rpDate (Fecha de expedición o registro del RP)
            - unidadEjecutora (Texto literal del campo 'UNIDAD EJECUTORA' si figura en el encabezado del RP, ej: "11401 - SECRETARIA TIC" o "11201 - SECRETARIA DE HACIENDA")
            - unidadEjecutoraCodigo (El código numérico de la unidad ejecutora, ej: "11401")
            - unidadEjecutoraNombre (El nombre de la unidad ejecutora, ej: "SECRETARIA TIC")
        `;

        let result;
        if (useMultimodal && isPdf) {
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
        
        const parsed = JSON.parse(jsonText);
        parsed.rubro = formatRubroPresupuestal(parsed.rubro || parsed.rubroCodigo, parsed.fuenteCodigo || parsed.fuenteFinanciacion);
        return parsed;
    } catch (error) {
        console.error("Error en extractRpData:", error);
        throw new Error("No se pudo procesar el RP con IA");
    }
};

exports.extractAdditionContractData = async (filePath, options = {}) => {
    try {
        const { buffer: dataBuffer, isPdf } = await resolveInputBuffer(filePath, options);
        let text = "";
        let useMultimodal = false;

        if (isPdf) {
            try {
                text = await parsePdfText(dataBuffer);
                if (!text || text.trim().length < 150) {
                    useMultimodal = true;
                }
            } catch (err) {
                console.warn("Extracción de texto modificatorio falló, usando Gemini multimodal OCR:", err.message);
                useMultimodal = true;
            }
        } else {
            text = dataBuffer.toString();
        }

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
        if (useMultimodal && isPdf) {
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

exports.extractBankCertificateData = async (filePath, options = {}) => {
    try {
        const { buffer: dataBuffer, filename, isPdf, isImage } = await resolveInputBuffer(filePath, options);
        let text = "";
        let useMultimodal = false;
        let unlockedWithCedula = false;
        let unlockedWithPassword = false;
        let usedPassword = null;
        let effectiveBuffer = dataBuffer;

        if (isPdf) {
            // Check encryption and unlock with candidate passwords (e.g. user cédula)
            const unlockResult = await unlockPdfWithCandidates(dataBuffer, {
                password: options.password,
                candidatePasswords: options.candidatePasswords,
                targetSavePath: (typeof filePath === 'string' && fs.existsSync(filePath)) ? filePath : null
            });

            text = unlockResult.text;
            usedPassword = unlockResult.usedPassword;
            if (unlockResult.cleanBuffer) {
                effectiveBuffer = unlockResult.cleanBuffer;
            }
            if (unlockResult.unlocked) {
                unlockedWithPassword = true;
                if (options.candidatePasswords && options.candidatePasswords.some(c => c && String(c).trim() === String(usedPassword))) {
                    unlockedWithCedula = true;
                }
            }

            if (!text || text.trim().length < 50) {
                useMultimodal = true;
            }
        } else {
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
        if ((useMultimodal && isPdf) || isImage) {
            console.log("Procesando certificado bancario escaneado o imagen. Usando modo multimodal de Gemini...");
            const ext = filename.split('.').pop().toLowerCase();
            const mimeType = isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : "application/pdf";
            const filePart = {
                inlineData: {
                    data: effectiveBuffer.toString("base64"),
                    mimeType: mimeType
                }
            };
            result = await generateAIContent([prompt, filePart]);
        } else {
            result = await generateAIContent(`${prompt}\n\nTexto de la certificación bancaria:\n${text.substring(0, 15000)}`);
        }

        const response = await result.response;
        const jsonText = response.text().replace(/```json|```/g, "").trim();
        const extracted = JSON.parse(jsonText);
        return {
            ...extracted,
            cleanBuffer: effectiveBuffer !== dataBuffer ? effectiveBuffer : null,
            unlockedWithCedula,
            unlockedWithPassword,
            usedPassword
        };
    } catch (error) {
        if (error.code === 'PASSWORD_REQUIRED') {
            throw error;
        }
        console.error("Error en extractBankCertificateData:", error);
        throw new Error("No se pudo procesar el certificado bancario con IA");
    }
};

exports.extractSecuritySocialData = async (filePath, options = {}) => {
    try {
        const { buffer: dataBuffer, filename, isPdf, isImage } = await resolveInputBuffer(filePath, options);
        let text = "";
        let useMultimodal = false;
        let unlockedWithCedula = false;
        let unlockedWithPassword = false;
        let usedPassword = null;
        let effectiveBuffer = dataBuffer;

        if (isPdf) {
            const unlockResult = await unlockPdfWithCandidates(dataBuffer, {
                password: options.password,
                candidatePasswords: options.candidatePasswords,
                targetSavePath: (typeof filePath === 'string' && fs.existsSync(filePath)) ? filePath : null
            });

            text = unlockResult.text;
            usedPassword = unlockResult.usedPassword;
            if (unlockResult.cleanBuffer) {
                effectiveBuffer = unlockResult.cleanBuffer;
            }
            if (unlockResult.unlocked) {
                unlockedWithPassword = true;
                if (options.candidatePasswords && options.candidatePasswords.some(c => c && String(c).trim() === String(usedPassword))) {
                    unlockedWithCedula = true;
                }
            }

            if (!text || text.trim().length < 150) {
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
            - totalPaid (Número entero. El valor total pagado en la planilla, ej: 585200 o 51600)
            - saludPaid (Número entero. El valor pagado al subsistema de salud, ej: 180000 o 21900)
            - pensionPaid (Número entero. El valor pagado al subsistema de pensiones, ej: 240000 o 28100)
            - arlPaid (Número entero. El valor pagado a riesgos laborales ARL, ej: 25200 o 1000)
            - ibc (Número entero. El Ingreso Base de Cotización IBC que figura en el detalle del aportante/afiliado, ej: 175091 o 1750910 o 1423500)
            - days (Número entero. Los días cotizados reportados en la planilla, ej: 3, 28, 30)
            - period (Periodo de cotización de los aportes en texto legible, ej: "Agosto de 2026", "Septiembre de 2026")
            - periodCotizadoInicio (Fecha inicio de cotización o periodo servicio en formato DD - MM - YYYY o YYYY-MM-DD si aparece, ej: "28 - 08 - 2026" o "01 - 09 - 2026")
            - periodCotizadoFin (Fecha fin de cotización o periodo servicio en formato DD - MM - YYYY o YYYY-MM-DD si aparece, ej: "30 - 08 - 2026" o "30 - 09 - 2026")
            - paymentDate (Fecha en que se pagó la planilla, ej: "25/09/2026")
            - interests (Número entero. Intereses de mora si aparecen, ej: 600)
        `;

        let result;
        if ((useMultimodal && isPdf) || isImage) {
            console.log("Procesando planilla de seguridad social escaneada o imagen. Usando modo multimodal de Gemini...");
            const ext = filename.split('.').pop().toLowerCase();
            const mimeType = isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : "application/pdf";
            const filePart = {
                inlineData: {
                    data: effectiveBuffer.toString("base64"),
                    mimeType: mimeType
                }
            };
            result = await generateAIContent([prompt, filePart]);
        } else {
            result = await generateAIContent(`${prompt}\n\nTexto de la planilla:\n${text.substring(0, 30000)}`);
        }

        const response = await result.response;
        const jsonText = response.text().replace(/```json|```/g, "").trim();
        
        const extracted = JSON.parse(jsonText);
        return {
            ...extracted,
            cleanBuffer: effectiveBuffer !== dataBuffer ? effectiveBuffer : null,
            unlockedWithCedula,
            unlockedWithPassword,
            usedPassword
        };
    } catch (error) {
        if (error.code === 'PASSWORD_REQUIRED') {
            throw error;
        }
        console.error("Error en extractSecuritySocialData:", error);
        if (error.message && (error.message.includes('password') || error.message.includes('Password') || error.message.includes('no pages'))) {
            const passErr = new Error("La planilla de seguridad social parece tener clave o estar protegida.");
            passErr.code = "PASSWORD_REQUIRED";
            throw passErr;
        }
        throw new Error("No se pudo procesar la planilla de seguridad social con IA");
    }
};

exports.extractActaInicioData = async (filePath, options = {}) => {
    try {
        const { buffer: dataBuffer, filename, isPdf, isImage } = await resolveInputBuffer(filePath, options);
        let text = "";
        let useMultimodal = false;

        if (isPdf) {
            try {
                text = await parsePdfText(dataBuffer);
                if (!text || text.trim().length < 80) {
                    useMultimodal = true;
                }
            } catch (err) {
                console.warn("Extracción de texto acta de inicio falló, usando Gemini multimodal OCR:", err.message);
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
            - executionTerm (Texto literal del plazo o duración del contrato si aparece en texto o días, ej: "CIENTO QUINCE (115) DIAS CALENDARIO..." o "115 DÍAS CALENDARIO")
            - unidadContratacion (Texto del campo 'Unidad de Contratación' o dependencia contratante que figura en el acta de inicio, ej: "SECRETARIA TIC" o "SECRETARÍA DE LAS TECNOLOGÍAS...")
        `;

        let result;
        if ((useMultimodal && isPdf) || isImage) {
            const ext = filename.split('.').pop().toLowerCase();
            const mimeType = isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : "application/pdf";
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

exports.extractRutData = async (filePath, options = {}) => {
    try {
        const { buffer: dataBuffer, filename, isPdf, isImage } = await resolveInputBuffer(filePath, options);
        let text = "";
        let useMultimodal = false;
        let unlockedWithCedula = false;
        let unlockedWithPassword = false;
        let usedPassword = null;
        let effectiveBuffer = dataBuffer;

        if (isPdf) {
            const unlockResult = await unlockPdfWithCandidates(dataBuffer, {
                password: options.password,
                candidatePasswords: options.candidatePasswords,
                targetSavePath: (typeof filePath === 'string' && fs.existsSync(filePath)) ? filePath : null
            });

            text = unlockResult.text;
            usedPassword = unlockResult.usedPassword;
            if (unlockResult.cleanBuffer) {
                effectiveBuffer = unlockResult.cleanBuffer;
            }
            if (unlockResult.unlocked) {
                unlockedWithPassword = true;
                if (options.candidatePasswords && options.candidatePasswords.some(c => c && String(c).trim() === String(usedPassword))) {
                    unlockedWithCedula = true;
                }
            }

            if (!text || text.trim().length < 80) {
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
        if ((useMultimodal && isPdf) || isImage) {
            console.log("Procesando RUT escaneado o imagen. Usando modo multimodal de Gemini...");
            const ext = filename.split('.').pop().toLowerCase();
            const mimeType = isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : "application/pdf";
            const filePart = {
                inlineData: {
                    data: effectiveBuffer.toString("base64"),
                    mimeType: mimeType
                }
            };
            result = await generateAIContent([prompt, filePart]);
        } else {
            result = await generateAIContent(`${prompt}\n\nTexto del RUT:\n${text.substring(0, 20000)}`);
        }

        const response = await result.response;
        const jsonText = response.text().replace(/```json|```/g, "").trim();
        const extracted = JSON.parse(jsonText);
        return {
            ...extracted,
            cleanBuffer: effectiveBuffer !== dataBuffer ? effectiveBuffer : null,
            unlockedWithCedula,
            unlockedWithPassword,
            usedPassword
        };
    } catch (error) {
        if (error.code === 'PASSWORD_REQUIRED') {
            throw error;
        }
        console.error("Error en extractRutData:", error);
        if (error.message && (error.message.includes('password') || error.message.includes('Password') || error.message.includes('no pages'))) {
            const passErr = new Error("El RUT parece tener clave o estar protegido.");
            passErr.code = "PASSWORD_REQUIRED";
            throw passErr;
        }
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

/**
 * Generates an extended technical description (100 to 150 words, or 200-260 for multi-page)
 * for the official "Anexo Descripcion #[codigo]" evidence document of an obligation.
 * Uses the obligation text, contractor's summary, individual evidence captions, and document titles as context.
 */
exports.generateObligationAnnexDescription = async ({
    obligationCode = '',
    obligationText = '',
    contractorComment = '',
    evidences = [],
    imageCount = 1
}) => {
    // Dynamic word target based on number of images / expected page count
    let minWords = 100;
    let maxWords = 150;
    if (imageCount > 3 && imageCount <= 6) {
        minWords = 200;
        maxWords = 260;
    } else if (imageCount > 6) {
        minWords = 300;
        maxWords = 380;
    }

    try {
        const evidenceDetails = (evidences || []).map((ev, idx) => {
            let cleanName = ev.filename || `Soporte ${idx + 1}`;
            if (cleanName.startsWith('evidence_') || cleanName.includes('-1790') || cleanName.includes('-1789')) {
                const ext = path.extname(cleanName).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
                    cleanName = `Registro fotográfico ${idx + 1}`;
                } else if (ext === '.xlsx' || ext === '.xls') {
                    cleanName = `Hoja de cálculo / Reporte de control ${idx + 1}`;
                } else {
                    cleanName = `Documento técnico / Soporte ${idx + 1}`;
                }
            }
            const desc = (ev.description || '').trim();
            return `  - Elemento ${idx + 1} (${cleanName}): ${desc ? desc : 'Sin descripción individual'}`;
        }).join('\n');

        const prompt = `
Eres un redactor experto de informes de supervisión y cuentas de cobro para contratos estatales en Colombia.
Tu tarea es redactar la DESCRIPCIÓN TÉCNICA DETALLADA para el formato oficial de evidencias ("Anexo Descripción") correspondiente a la siguiente obligación contractual.

DATOS DE LA OBLIGACIÓN:
- Código de la obligación: ${obligationCode || '2.2'}
- Texto de la obligación: ${obligationText}

CONTEXTO APORTADO POR EL CONTRATISTA:
- Resumen / Actividades ejecutadas: ${contractorComment || 'Se desarrollaron las actividades programadas a entera satisfacción.'}
- Evidencias y soportes adjuntos:
${evidenceDetails || '  - Registro de soportes de ejecución y cumplimiento'}

REGLAS ESTRICTAS DE REDACCIÓN:
1. LONGITUD OBLIGATORIA: EXACTAMENTE entre ${minWords} y ${maxWords} palabras. No debes generar menos de ${minWords} palabras ni más de ${maxWords} palabras.
2. ESTILO Y TONO: Redacta en estilo técnico, formal, institucional y descriptivo de la labor ejecutada, en tercera persona o voz pasiva (ejemplos: "En cumplimiento de la obligación...", "Se procedió a realizar...", "Se llevaron a cabo labores de...", "Se verificó la funcionalidad de...").
3. COHERENCIA TÉCNICA: Integra con naturalidad la información del resumen del contratista y los soportes reportados, justificando cómo cada labor contribuyó al cabal cumplimiento de la obligación contractual.
4. ESTRUCTURA: Redacta en texto corrido, organizado en 1 o 2 párrafos bien redactados.
5. FORMATO FINAL: Entrega ÚNICAMENTE el texto redactado en texto plano, sin comillas, sin viñetas, sin títulos, sin asteriscos (sin markdown) y sin mensajes introductorios (como "A continuación presento..." o "Aquí está...").
6. NOMENCLATURA LIMPIA DE SOPORTES: NUNCA menciones nombres de archivo crudos, técnicos o con hashes como "evidence_0-179...pdf". Si mencionas documentos o imágenes, hazlo de forma profesional e institucional (ejemplos: "Conceptos técnicos emitidos", "Reportes de mantenimiento adjuntos", "Hojas de cálculo de control", "Registro fotográfico adjunto", "Soportes documentales en formato PDF").
`;

        const result = await generateAIContent(prompt);
        const response = await result.response;
        let generatedText = response.text().trim().replace(/^["']|["']$/g, '');

        let words = generatedText.split(/\s+/).filter(Boolean);
        if (words.length > maxWords + 10) {
            let trimmed = words.slice(0, maxWords).join(' ');
            trimmed = trimmed.replace(/[,;:]$/, '');
            if (!/[.!?]$/.test(trimmed)) trimmed += '.';
            generatedText = trimmed;
        }

        return generatedText;
    } catch (error) {
        console.warn("Aviso: No se pudo generar la descripción extendida con IA, usando generador técnico de respaldo:", error.message);
        
        // Fallback: structured professional description synthesizing contractor's inputs
        const parts = [];
        const codePrefix = obligationCode ? `En desarrollo y estricto cumplimiento de la obligación ${obligationCode}, ` : 'En desarrollo de las obligaciones contractuales pactadas, ';
        parts.push(`${codePrefix}se ejecutaron a cabalidad las actividades orientadas a ${obligationText.toLowerCase().replace(/^realizar\s+|^ejecutar\s+|^apoyar\s+/, '')}.`);
        
        if (contractorComment && contractorComment.trim()) {
            parts.push(`Durante el periodo objeto de cobro, el contratista adelantó las siguientes labores técnicas: ${contractorComment.trim()}.`);
        }

        const customCaptions = (evidences || [])
            .map(e => (e.description || '').trim())
            .filter(d => d.length > 5 && (!contractorComment || !contractorComment.includes(d)));

        if (customCaptions.length > 0) {
            parts.push(`Asimismo, se constata la realización específica de: ${customCaptions.join('; ')}.`);
        }

        parts.push(`Dichas actuaciones permitieron garantizar la continuidad del servicio, la optimización operativa y el cumplimiento de los estándares de calidad y oportunidad exigidos por la supervisión del contrato.`);

        return parts.join(' ');
    }
};

/**
 * Generates the formal overview text for the section "Evidencias de la ejecución del contrato"
 * in the official Informe de Actividades, synthesizing the evidence types, technical reports,
 * and pointing the supervisor to the "Anexo Descripción" documents and folder structure.
 */
exports.generateExecutionEvidencesSummary = async ({
    contractObject = '',
    contractType = '',
    activities = []
}) => {
    // Collect context about the activities and evidence types
    const actsSummary = (activities || []).map((act, i) => {
        const code = act.obligationCode || `2.2.${i + 1}`;
        const text = act.obligationText || '';
        const evTypes = (act.evidences || []).map(e => e.filename || 'soporte').join(', ');
        return `- Obligación ${code} (${text.substring(0, 80)}): ${evTypes ? 'Archivos: ' + evTypes : 'Sin archivos específicos'}`;
    }).join('\n');

    // Default fallback adhering strictly to the user's template
    const defaultFallback = `Durante el período reportado, se han recopilado diversas evidencias que respaldan la ejecución satisfactoria del contrato. Estas evidencias incluyen:

• Archivos en formato Word y PDF con informes detallados ("Anexo Descripción") sobre las actividades realizadas, incluyendo material fotográfico y descripciones específicas de cada acción llevada a cabo.

• Archivos en formato PDF y hojas de cálculo de reportes técnicos y de mantenimiento preventivo y correctivo.

• Listados de asistencia, planillas y soportes de control según las obligaciones contractuales.

Los anexos oficiales correspondientes y la totalidad de los soportes se encuentran debidamente clasificados y adjuntos en la carpeta correspondiente a cada obligación en el paquete de cobro entregado a la supervisión.`;

    try {
        const prompt = `
Eres un redactor experto de informes de actividades y cuentas de cobro para contratos estatales en Colombia.
Tu tarea es redactar el texto formal para la sección "Evidencias de la ejecución del contrato" del Informe de Actividades oficial.

CONTEXTO DEL CONTRATO:
- Objeto del contrato: ${contractObject || 'Prestación de servicios profesionales o de apoyo a la gestión'}
- Tipo de contrato: ${contractType || 'Prestación de servicios'}
- Obligaciones y soportes reportados en el periodo:
${actsSummary || 'Ejecución integral de obligaciones técnicas'}

ESTRUCTURA OBLIGATORIA A GENERAR:
1. Párrafo introductorio formal:
"Durante el período reportado, se han recopilado diversas evidencias que respaldan la ejecución satisfactoria del contrato. Estas evidencias incluyen:"

2. Entre 3 y 4 viñetas (iniciadas estrictamente con el símbolo "•") que detallen los tipos de evidencias técnicas y documentales generadas en el periodo, adaptadas al objeto del contrato y a las labores reportadas (por ejemplo: documentos oficiales Anexo Descripción con informes detallados y registro fotográfico, reportes técnicos de mantenimiento preventivo y correctivo, archivos y hojas de cálculo en Excel/PDF, listados de asistencia, actas o planillas de control si corresponden).

3. Párrafo final de cierre formal:
"Los anexos oficiales correspondientes ("Anexo Descripción") y la totalidad de los soportes digitales se encuentran debidamente clasificados y adjuntos en la carpeta correspondiente a cada obligación en el paquete de cobro entregado a la supervisión."

REGLAS ESTRICTAS:
- Tono institucional, técnico, impecable y formal para la administración pública colombiana.
- Entrega ÚNICAMENTE el texto final en texto plano, sin markdown de negritas con asteriscos (**), sin títulos extras ni encabezados, listo para insertar en el documento Word.
- Deja una línea en blanco entre párrafos y entre viñetas para una lectura limpia.
`;

        const result = await generateAIContent(prompt);
        const response = await result.response;
        let generatedText = response.text().trim().replace(/^["']|["']$/g, '');

        // Remove any markdown bolding like **
        generatedText = generatedText.replace(/\*\*/g, '');

        if (generatedText && generatedText.length > 80) {
            return generatedText;
        }
        return defaultFallback;
    } catch (error) {
        console.warn("Aviso: No se pudo generar el resumen de evidencias con IA, usando plantilla formal:", error.message);
        return defaultFallback;
    }
};



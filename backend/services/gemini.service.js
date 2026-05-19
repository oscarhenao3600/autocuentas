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
            - totalValue (Valor total del contrato, en letras y/o números)
            - monthlyValue (Valor mensual o cuota a pagar, si especifica forma de pago fraccionada, en número o texto)
            - bankName (Nombre de la entidad bancaria)
            - accountNumber (Número de cuenta bancaria)
            - paymentMethod (Forma de pago, ej: Transferencia electrónica, consignación)
            - contractObject (Objeto del contrato, descripción de las actividades o servicios prestados)
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

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const pdf = require("pdf-parse");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.extractContractData = async (filePath) => {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        let text = "";

        if (filePath.endsWith('.pdf')) {
            const data = await pdf(dataBuffer);
            text = data.text;
        } else {
            // For docx or other text files, we might need mammoth, but let's assume PDF for the contract base for now
            // Or we can use Gemini's file upload if supported, but text extraction is more reliable for simple data
            text = dataBuffer.toString(); 
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            Analiza el siguiente texto de un contrato de prestación de servicios y extrae la información en formato JSON puro (sin markdown). 
            Campos requeridos:
            - contractorName (Nombre completo del contratista)
            - idNumber (Cédula o NIT)
            - contractNumber (Número de contrato, ej: 001-2026)
            - contractObject (Objeto del contrato)
            - totalValue (Valor total del contrato)
            - monthlyValue (Valor mensual o de la cuota)
            - duration (Plazo de ejecución)
            - bankName (Nombre del banco si aparece)
            - accountNumber (Número de cuenta si aparece)
            - accountType (Tipo de cuenta: Ahorros/Corriente)

            Texto del contrato:
            ${text.substring(0, 20000)} // Limit text to avoid token limits
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text().replace(/```json|```/g, "").trim();
        
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error en Gemini Service:", error);
        throw new Error("No se pudo procesar el documento con IA");
    }
};

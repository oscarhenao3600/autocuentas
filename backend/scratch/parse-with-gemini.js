const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
require("dotenv").config({ path: "../.env" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyB1155zQrnnxIlzI9T_qIzsneS8yCfxpoc");

async function parseAddition() {
    const filePath = `D:\\ALCALDIA DE ARMENIA\\CONTRATO_2026\\CUENTAS DE COBRO 2026 ALCALDIA\\Modificatorio Adicion Oscar Alexander Henao.pdf`;
    if (!fs.existsSync(filePath)) {
        console.error("File not found:", filePath);
        return;
    }

    const dataBuffer = fs.readFileSync(filePath);
    const pdfPart = {
        inlineData: {
            data: dataBuffer.toString("base64"),
            mimeType: "application/pdf"
        }
    };

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
        Analiza el siguiente documento modificatorio (adición y/o prórroga) de un contrato de prestación de servicios
        y extrae la información relevante en formato JSON puro.
        
        Campos requeridos:
        - additionValue (Valor numérico total de la adición, ej: 5600000)
        - additionValueWord (El valor total de la adición en letras, ej: "CINCO MILLONES SEISCIENTOS MIL PESOS M/CTE")
        - additionStartDate (Fecha de inicio de la adición, si aparece de forma explícita, ej: "15 de mayo de 2026")
        - additionEndDate (Fecha de terminación de la adición, si aparece, ej: "14 de julio de 2026")
        - additionCdp (Número de CDP de la adición, si aparece)
        - additionRp (Número de RP de la adición, si aparece)
        - additionRubro (Código o Rubro presupuestal de la adición, si aparece)
        - additionDuration (Plazo o duración de la adición, ej: "DOS (02) MESES")
    `;

    console.log("Enviando PDF de Adición a Gemini...");
    const result = await model.generateContent([prompt, pdfPart]);
    const response = await result.response;
    console.log("=== GEMINI RESPONSE ===");
    console.log(response.text());
}

parseAddition().catch(console.error);

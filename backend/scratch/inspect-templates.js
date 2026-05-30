const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

const templatesDir = `D:\\Desarollo\\FotmatosCuentas\\backend\\templates`;

async function extractText(filePath) {
    if (!fs.existsSync(filePath)) {
        return `[File not found: ${filePath}]`;
    }
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
}

async function run() {
    console.log("=== INFORME DE ACTIVIDADES TEMPLATE ===");
    const text1 = await extractText(path.join(templatesDir, 'FORMATO INFORME DE ACTIVIDADES.docx'));
    console.log(text1.trim());

    console.log("\n=== RETENCION EN LA FUENTE TEMPLATE ===");
    const text2 = await extractText(path.join(templatesDir, 'FORMATO RETENCION EN LA FUENTE.docx'));
    console.log(text2.trim());

    console.log("\n=== CERTIFICADO DEL SUPERVISOR TEMPLATE ===");
    const text3 = await extractText(path.join(templatesDir, 'FORMATO CERTIFICADO DEL SUPERVISOR.docx'));
    console.log(text3.trim().substring(0, 1500));
}

run().catch(console.error);

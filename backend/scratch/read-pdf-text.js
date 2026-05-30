const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

console.log("pdf is:", typeof pdf, pdf);

const pdfPath = `D:\\ALCALDIA DE ARMENIA\\CONTRATO_2026\\CUENTAS DE COBRO 2026 ALCALDIA\\Modificatorio Adicion Oscar Alexander Henao.pdf`;
const rpPath = `D:\\ALCALDIA DE ARMENIA\\CONTRATO_2026\\CUENTAS DE COBRO 2026 ALCALDIA\\RP_4412_2026.pdf`;

async function readPdf(filePath) {
    if (!fs.existsSync(filePath)) {
        return `File not found: ${filePath}`;
    }
    const dataBuffer = fs.readFileSync(filePath);
    // If pdf-parse has a default export or different export structure
    const parse = typeof pdf === 'function' ? pdf : pdf.default || pdf.parse;
    if (typeof parse !== 'function') {
        throw new Error("Could not find parse function in pdf-parse");
    }
    const data = await parse(dataBuffer);
    return data.text;
}

async function run() {
    console.log("=== MODIFICATORIO ADICION PDF ===");
    const textMod = await readPdf(pdfPath);
    console.log(textMod.substring(0, 2500));

    console.log("\n=== RP 4412 PDF ===");
    const textRp = await readPdf(rpPath);
    console.log(textRp.substring(0, 1500));
}

run().catch(console.error);

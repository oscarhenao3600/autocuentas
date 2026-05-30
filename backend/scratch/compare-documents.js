const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

const dir3 = `D:\\ALCALDIA DE ARMENIA\\CONTRATO_2026\\CUENTAS DE COBRO 2026 ALCALDIA\\CUENTA3`;
const dir4 = `D:\\ALCALDIA DE ARMENIA\\CONTRATO_2026\\CUENTAS DE COBRO 2026 ALCALDIA\\CUENTA4`;

async function extractText(filePath) {
    if (!fs.existsSync(filePath)) {
        return `[File not found: ${filePath}]`;
    }
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
}

async function run() {
    console.log("=== COMPARING CERTIFICADO DEL SUPERVISOR ===");
    const text3_1 = await extractText(path.join(dir3, '1-CERTIFICADO DEL SUPERVISOR.docx'));
    const text4_1 = await extractText(path.join(dir4, '1-CERTIFICADO DEL SUPERVISOR.docx'));
    console.log("--- CUENTA 3 CERTIFICADO ---");
    console.log(text3_1.trim().substring(0, 1000));
    console.log("\n--- CUENTA 4 CERTIFICADO ---");
    console.log(text4_1.trim().substring(0, 1000));

    console.log("\n=== COMPARING INFORME DE ACTIVIDADES ===");
    const text3_2 = await extractText(path.join(dir3, '2-INFORME DE ACTIVIDADES.docx'));
    const text4_2 = await extractText(path.join(dir4, '2-INFORME DE ACTIVIDADES.docx'));
    console.log("--- CUENTA 3 INFORME ---");
    console.log(text3_2.trim().substring(0, 1000));
    console.log("\n--- CUENTA 4 INFORME ---");
    console.log(text4_2.trim().substring(0, 1000));

    console.log("\n=== COMPARING RETENCION EN LA FUENTE ===");
    const text3_4 = await extractText(path.join(dir3, '4-RETENCION EN LA FUENTE.docx'));
    const text4_4 = await extractText(path.join(dir4, '4-RETENCION EN LA FUENTE.docx'));
    console.log("--- CUENTA 3 RETENCION ---");
    console.log(text3_4.trim().substring(0, 1000));
    console.log("\n--- CUENTA 4 RETENCION ---");
    console.log(text4_4.trim().substring(0, 1000));
}

run().catch(console.error);

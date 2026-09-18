const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const mammoth = require('mammoth');

const tplPath = path.join(__dirname, 'test_patched_template.docx');
if (!fs.existsSync(tplPath)) {
    console.error("Test template not found!");
    process.exit(1);
}

const content = fs.readFileSync(tplPath, 'binary');
const zip = new PizZip(content);
const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
});

const data = {
    periodToDate: "03/06/2026",
    supervisorName: "ING. CARLOS GOMEZ - SUPERVISOR DE T.I.",
    contractorName: "JUAN PEREZ SANCHEZ",
    idNumber: "1.094.123.456",
    contractType: "Prestacion de Servicios",
    contractNumber: "003-2026",
    startDate: "01 de marzo de 2026",
    endDate: "01 de julio de 2026",
    cdp: "67890",
    rp: "12345",
    rubro: "SERVICIOS PROFESIONALES DE APOYO A LA GESTION",
    totalValue: "18.000.000",
    bankName: "BANCOLOMBIA",
    accountNumber: "987-654321-09",
    paymentMethod: "Ahorros",
    remainingValue: "4.500.000",
    monthlyValue: "4.500.000",
    periodFrom: "01 de mayo de 2026",
    periodTo: "30 de mayo de 2026",
    ssPlanilla: "889912345",
    ssPension: "240.000",
    ssSalud: "180.000",
    ssArl: "25.200",
    foliosContratista: "2",
    foliosSupervisor: "1",
    actNumberText: "TERCER PAGO",
    actNumber: "3"
};

doc.setData(data);

try {
    doc.render();
} catch (error) {
    console.error("Docxtemplater error:", error);
    process.exit(1);
}

const outBuffer = doc.getZip().generate({ type: 'nodebuffer' });
const outPath = path.join(__dirname, 'test_compiled_output.docx');
fs.writeFileSync(outPath, outBuffer);
console.log("Compiled document written to scratch/test_compiled_output.docx");

// Extract text
mammoth.extractRawText({ path: outPath }).then(result => {
    fs.writeFileSync(path.join(__dirname, 'patched_compiled_text.txt'), result.value);
    console.log("Extracted text to scratch/patched_compiled_text.txt");
}).catch(err => {
    console.error("Mammoth error:", err);
});

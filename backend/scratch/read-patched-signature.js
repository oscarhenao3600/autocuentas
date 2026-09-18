const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const tplPath = path.join(__dirname, '..', 'templates', 'FORMATO CERTIFICADO DEL SUPERVISOR.docx');
if (!fs.existsSync(tplPath)) {
    console.error("No template found!");
    process.exit(1);
}

const buffer = fs.readFileSync(tplPath);
const zip = new PizZip(buffer);
const xml = zip.file('word/document.xml').asText();

const index = xml.indexOf('FIRMA DEL');
if (index === -1) {
    console.log("No se encontró 'FIRMA DEL'");
} else {
    console.log("Encontrado 'FIRMA DEL' en índice:", index);
    const start = Math.max(0, index - 200);
    const end = Math.min(xml.length, index + 800);
    console.log("XML alrededor:");
    console.log(xml.substring(start, end));
}

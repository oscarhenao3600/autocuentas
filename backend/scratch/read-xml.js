const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const tplPath = path.join(__dirname, '..', 'templates', 'FORMATO CERTIFICADO DEL SUPERVISOR.docx');
if (!fs.existsSync(tplPath)) {
    console.error("❌ Archivo plantilla no encontrado.");
    process.exit(1);
}

const buffer = fs.readFileSync(tplPath);
const zip = new PizZip(buffer);
const docXml = zip.file('word/document.xml').asText();

fs.writeFileSync(path.join(__dirname, 'xml_dump.xml'), docXml);
console.log("XML dumped successfully to scratch/xml_dump.xml");

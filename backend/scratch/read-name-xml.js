const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const docxPath = path.join(__dirname, '..', 'templates', 'FORMATO DESCUENTO DE ESTAMPILLAS_CONVERTIDO.docx');
const buffer = fs.readFileSync(docxPath);
const zip = new PizZip(buffer);
const xml = zip.file('word/document.xml').asText();

const startIdx = xml.indexOf('Nombre y Apellido');
const endIdx = xml.indexOf('Cédula');

console.log("=== XML entre 'Nombre y Apellido' y 'Cédula' ===");
console.log(xml.substring(startIdx - 100, endIdx + 150));

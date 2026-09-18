const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { DOMParser } = require('@xmldom/xmldom');

const docxPath = path.join(__dirname, '..', 'templates', 'FORMATO DESCUENTO DE ESTAMPILLAS_CONVERTIDO.docx');
const buffer = fs.readFileSync(docxPath);
const zip = new PizZip(buffer);
const xml = zip.file('word/document.xml').asText();

const parser = new DOMParser();
const doc = parser.parseFromString(xml, 'text/xml');
const ts = doc.getElementsByTagName('w:t');

console.log("=== Analizando de Index 0 a 14 ===");
for (let i = 0; i <= 14; i++) {
    if (ts[i]) {
        console.log(`Index ${i}: "${ts[i].textContent}"`);
    }
}

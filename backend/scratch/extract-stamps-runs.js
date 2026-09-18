const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { DOMParser } = require('@xmldom/xmldom');

const docxPath = path.join(__dirname, '..', 'templates', 'FORMATO DESCUENTO DE ESTAMPILLAS_CONVERTIDO.docx');
if (!fs.existsSync(docxPath)) {
    console.error("No existe.");
    process.exit(1);
}

const buffer = fs.readFileSync(docxPath);
const zip = new PizZip(buffer);
const xml = zip.file('word/document.xml').asText();

const parser = new DOMParser();
const doc = parser.parseFromString(xml, 'text/xml');
const ts = doc.getElementsByTagName('w:t');

console.log(`Total tags <w:t> encontrados: ${ts.length}`);
for (let i = 0; i < ts.length; i++) {
    const text = ts[i].textContent;
    if (text.includes('____') || text.includes('Nombre') || text.includes('Cédula') || text.includes('Dirección') || text.includes('Teléfono') || text.includes('Ciudad y fecha')) {
        console.log(`Index ${i}: "${text}"`);
    }
}

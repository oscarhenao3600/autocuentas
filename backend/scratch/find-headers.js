const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const backupPath = path.join(__dirname, '..', 'templates', 'FORMATO CERTIFICADO DEL SUPERVISOR.docx.bak');
if (!fs.existsSync(backupPath)) {
    console.error("No backup found!");
    process.exit(1);
}

const buffer = fs.readFileSync(backupPath);
const zip = new PizZip(buffer);
const xml = zip.file('word/document.xml').asText();

const searchStr = '___/____/_____';
let index = 0;
let count = 0;
while ((index = xml.indexOf(searchStr, index)) !== -1) {
    count++;
    console.log(`\n--- Ocurrencia Cabezote ${count} en índice: ${index} ---`);
    const start = Math.max(0, index - 100);
    const end = Math.min(xml.length, index + 350);
    console.log(xml.substring(start, end));
    index += searchStr.length;
}
console.log(`\nTotal cabezotes encontrados: ${count}`);

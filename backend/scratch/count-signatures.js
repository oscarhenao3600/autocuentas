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

let index = 0;
let count = 0;
while ((index = xml.indexOf('FIRMA DEL', index)) !== -1) {
    count++;
    console.log(`\n--- Ocurrencia ${count} en índice: ${index} ---`);
    const start = Math.max(0, index - 200);
    const end = Math.min(xml.length, index + 350);
    console.log(xml.substring(start, end));
    index += 9; // length of 'FIRMA DEL'
}
console.log(`\nTotal ocurrencias encontradas: ${count}`);

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const backupPath = path.join(__dirname, '..', 'templates', 'FORMATO CERTIFICADO DEL SUPERVISOR.docx.bak');
const buffer = fs.readFileSync(backupPath);
const zip = new PizZip(buffer);
const xml = zip.file('word/document.xml').asText();

console.log("xml.includes('QUE CORRESPONDE A:'):", xml.includes('QUE CORRESPONDE A:'));
console.log("xml.includes('QUE CORRESPONDE A: ANTICIPO'):", xml.includes('QUE CORRESPONDE A: ANTICIPO'));
console.log("xml.includes('ANTICIPO'):", xml.includes('ANTICIPO'));

// Let's print some chars around the first occurrence of ANTICIPO
let idx = xml.indexOf("ANTICIPO");
if (idx !== -1) {
    console.log("Context around 'ANTICIPO':");
    console.log(xml.substring(idx - 100, idx + 100));
}

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

const targetText = "QUE CORRESPONDE A: ANTICIPO";
const targetIndex = xml.indexOf(targetText);

if (targetIndex === -1) {
    console.log("No se encontró 'QUE CORRESPONDE A: ANTICIPO'");
    process.exit(0);
}

let p1Start = xml.lastIndexOf("<w:p", targetIndex);
while (p1Start !== -1 && xml.substring(p1Start, p1Start + 6).startsWith("<w:pPr")) {
    p1Start = xml.lastIndexOf("<w:p", p1Start - 1);
}

const p1End = xml.indexOf("</w:p>", targetIndex) + 6;
const p2Start = xml.indexOf("<w:p", p1End);
const p2End = xml.indexOf("</w:p>", p2Start) + 6;

console.log("p1Start:", p1Start);
console.log("p1End:", p1End);
console.log("p2Start:", p2Start);
console.log("p2End:", p2End);

console.log("\n--- Contenido entre p1Start y p1End (Párrafo 1) ---");
console.log(xml.substring(p1Start, p1End));

console.log("\n--- Contenido entre p1End y p2Start (Entre párrafos) ---");
console.log(xml.substring(p1End, p2Start));

console.log("\n--- Contenido entre p2Start y p2End (Párrafo 2) ---");
console.log(xml.substring(p2Start, p2End));

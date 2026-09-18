const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const backupPath = path.join(__dirname, '..', 'templates', 'FORMATO CERTIFICADO DEL SUPERVISOR.docx.bak');
const buffer = fs.readFileSync(backupPath);
const zip = new PizZip(buffer);
const xml = zip.file('word/document.xml').asText();

// Regex to find content inside w:t tags
const regex = /<w:t[^>]*>([_/\s\$\-]*?)<\/w:t>/gi;
let match;
console.log("=== SCANNING FOR UNDERSCORE RUNS IN CLEAN BACKUP XML ===");
while ((match = regex.exec(xml)) !== null) {
    const text = match[1];
    if (text.includes("_")) {
        console.log(`Match: "${text}" (length: ${text.length})`);
    }
}

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { DOMParser } = require('@xmldom/xmldom');

// Find the latest generated supervisor certificate file
const genDir = path.join(__dirname, '..', 'generated');
const files = fs.readdirSync(genDir).filter(f => f.includes('FORMATO CERTIFICADO DEL SUPERVISOR') && f.endsWith('.docx'));

if (files.length === 0) {
    console.error("No se encontraron certificados generados.");
    process.exit(1);
}

// Sort files to get the latest
files.sort((a, b) => {
    return fs.statSync(path.join(genDir, b)).mtimeMs - fs.statSync(path.join(genDir, a)).mtimeMs;
});

const latestFile = path.join(genDir, files[0]);
console.log("Examinando el archivo:", latestFile);

const buffer = fs.readFileSync(latestFile);
const zip = new PizZip(buffer);
const xmlText = zip.file('word/document.xml').asText();

console.log("Intentando parsear word/document.xml con DOMParser...");
try {
    const parser = new DOMParser({
        onError: (level, msg) => {
            console.error(`❌ [${level}] XML Error:`, msg);
        }
    });
    const doc = parser.parseFromString(xmlText, 'text/xml');
    console.log("✅ Parseo finalizado.");
} catch (err) {
    console.error("🔥 Error al parsear XML:", err);
}

// Guardar el XML para inspección si fuera necesario
fs.writeFileSync(path.join(__dirname, 'document_debug.xml'), xmlText);
console.log("XML de document.xml guardado en backend/scratch/document_debug.xml");

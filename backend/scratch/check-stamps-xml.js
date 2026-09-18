const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { DOMParser } = require('@xmldom/xmldom');

// Find the latest generated stamps file
const genDir = path.join(__dirname, '..', 'generated');
const files = fs.readdirSync(genDir).filter(f => f.includes('FORMATO DESCUENTO DE ESTAMPILLAS') && f.endsWith('.docx'));

if (files.length === 0) {
    console.error("No se encontraron estampillas generadas.");
    process.exit(1);
}

files.sort((a, b) => {
    return fs.statSync(path.join(genDir, b)).mtimeMs - fs.statSync(path.join(genDir, a)).mtimeMs;
});

const latestFile = path.join(genDir, files[0]);
console.log("Examinando el archivo de estampillas:", latestFile);

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
    console.log("✅ Parseo finalizado sin errores fatales.");
} catch (err) {
    console.error("🔥 Error fatal al parsear XML:", err);
}

// Guardar el XML para inspección si fuera necesario
fs.writeFileSync(path.join(__dirname, 'stamps_debug.xml'), xmlText);
console.log("XML guardado en backend/scratch/stamps_debug.xml");

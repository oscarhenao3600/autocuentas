const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { DOMParser } = require('@xmldom/xmldom');

const tplPath = path.join(__dirname, '..', 'templates', 'FORMATO CERTIFICADO DEL SUPERVISOR.docx');
const backupPath = path.join(__dirname, '..', 'templates', 'FORMATO CERTIFICADO DEL SUPERVISOR.docx.bak');

function checkFile(filePath, label) {
    console.log(`\n=== Verificando ${label} en: ${filePath} ===`);
    if (!fs.existsSync(filePath)) {
        console.log("❌ Archivo no existe.");
        return;
    }
    try {
        const buffer = fs.readFileSync(filePath);
        const zip = new PizZip(buffer);
        const xmlText = zip.file('word/document.xml').asText();
        
        const parser = new DOMParser({
            onError: (level, msg) => {
                console.error(`❌ XML Error [${level}]:`, msg);
            }
        });
        parser.parseFromString(xmlText, 'text/xml');
        console.log("✅ XML parseado con éxito sin errores fatales.");
    } catch (err) {
        console.error("🔥 Error al verificar:", err);
    }
}

checkFile(backupPath, "BACKUP ORIGINAL");
checkFile(tplPath, "PLANTILLA AUTOMATIZADA");

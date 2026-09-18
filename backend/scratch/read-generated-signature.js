const fs = require('fs');
const path = require('path');

const debugXmlPath = path.join(__dirname, 'document_debug.xml');
if (!fs.existsSync(debugXmlPath)) {
    console.error("No debug XML found!");
    process.exit(1);
}

const xml = fs.readFileSync(debugXmlPath, 'utf8');
const index = xml.indexOf('FIRMA DEL');
if (index === -1) {
    console.log("No se encontró 'FIRMA DEL'");
} else {
    console.log("Encontrado 'FIRMA DEL' en el documento generado final:");
    const start = Math.max(0, index - 200);
    const end = Math.min(xml.length, index + 800);
    console.log(xml.substring(start, end));
}

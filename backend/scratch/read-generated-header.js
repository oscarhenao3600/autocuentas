const fs = require('fs');
const path = require('path');

const debugXmlPath = path.join(__dirname, 'document_debug.xml');
if (!fs.existsSync(debugXmlPath)) {
    console.error("No debug XML found!");
    process.exit(1);
}

const xml = fs.readFileSync(debugXmlPath, 'utf8');
const index = xml.indexOf('Secretaría de Planeación');
if (index === -1) {
    console.log("No se encontró 'Secretaría de Planeación'");
} else {
    console.log("Encontrado 'Secretaría de Planeación' en el documento generado:");
    const start = Math.max(0, index - 200);
    const end = Math.min(xml.length, index + 300);
    console.log(xml.substring(start, end));
}

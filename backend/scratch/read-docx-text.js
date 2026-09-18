const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const docxPath = path.join(__dirname, '..', 'templates', 'FORMATO DESCUENTO DE ESTAMPILLAS.docx');
if (!fs.existsSync(docxPath)) {
    console.error("No existe el archivo docx.");
    process.exit(1);
}

try {
    const buffer = fs.readFileSync(docxPath);
    const zip = new PizZip(buffer);
    const xml = zip.file('word/document.xml').asText();
    console.log("xml length:", xml.length);
    console.log(xml.substring(0, 1000));
} catch (err) {
    console.error("Error al abrir el docx:", err.message);
}

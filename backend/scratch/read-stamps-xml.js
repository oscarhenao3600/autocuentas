const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const docxPath = path.join(__dirname, '..', 'templates', 'FORMATO DESCUENTO DE ESTAMPILLAS_CONVERTIDO.docx');
if (!fs.existsSync(docxPath)) {
    console.error("No existe.");
    process.exit(1);
}

const buffer = fs.readFileSync(docxPath);
const zip = new PizZip(buffer);
const xml = zip.file('word/document.xml').asText();

// Buscar partes clave
function findSnippet(query, before = 150, after = 350) {
    const idx = xml.indexOf(query);
    if (idx === -1) {
        console.log(`No se encontró: "${query}"`);
    } else {
        console.log(`\n--- Snippet para "${query}" ---`);
        console.log(xml.substring(idx - before, idx + after));
    }
}

findSnippet("Ciudad y fecha:");
findSnippet("Nombre y Apellido:");
findSnippet("Dirección:");
findSnippet("Prestación de Servicios Apoyo a la Gestión");
findSnippet("Nombre y Apellido", xml.indexOf("Atentamente") - 100);

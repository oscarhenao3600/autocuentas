const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const docxPath = path.join(__dirname, '..', 'templates', 'FORMATO DESCUENTO DE ESTAMPILLAS_CONVERTIDO.docx');
const buffer = fs.readFileSync(docxPath);
const zip = new PizZip(buffer);
const xml = zip.file('word/document.xml').asText();

function inspectBetween(query1, query2) {
    const startIdx = xml.indexOf(query1);
    const endIdx = xml.indexOf(query2);
    if (startIdx === -1 || endIdx === -1) {
        console.log(`No se encontraron ambos para: "${query1}" y "${query2}"`);
        return;
    }
    console.log(`\n=== XML entre '${query1}' y '${query2}' ===`);
    console.log(xml.substring(startIdx - 50, endIdx + 150));
}

inspectBetween("Cédula", "Dirección");
inspectBetween("Dirección", "Teléfono");
inspectBetween("Teléfono", "Manifiesto");

const fs = require('fs');
const path = require('path');

const xmlPath = path.join(__dirname, 'xml_dump.xml');
if (!fs.existsSync(xmlPath)) {
    console.error("xml_dump.xml not found. Run read-xml.js first.");
    process.exit(1);
}

const docXml = fs.readFileSync(xmlPath, 'utf8');

// Helper to find a substring and show context
function showContext(query, radius = 200) {
    console.log(`\n--- Searching for: "${query}" ---`);
    let index = 0;
    while ((index = docXml.indexOf(query, index)) !== -1) {
        const start = Math.max(0, index - radius);
        const end = Math.min(docXml.length, index + query.length + radius);
        console.log(`Match at index ${index}:`);
        console.log(docXml.substring(start, end));
        console.log("-----------------------------------------");
        index += query.length;
    }
}

// Check for common strings from template_text.txt
showContext("NOMBRE O RAZON SOCIAL");
showContext("No. DE IDENTIFICACIÓN");
showContext("CLASE O TIPO DE CONTRATO");
showContext("FECHA DEL ACTA DE INICIO");
showContext("CDP:");
showContext("VALOR TOTAL:");
showContext("VALOR AUTORIZADO");
showContext("SALDO RESTANTE:");
showContext("PERIODO A PAGAR:");
showContext("SOPORTES:");

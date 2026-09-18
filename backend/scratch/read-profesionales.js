const fs = require('fs');
const path = require('path');

const xmlPath = path.join(__dirname, 'stamps_debug.xml');
const xml = fs.readFileSync(xmlPath, 'utf8');

const idx = xml.indexOf('Profesionales');
if (idx === -1) {
    console.log("No se encontró 'Profesionales'");
} else {
    console.log("Alrededor de 'Profesionales':");
    console.log(xml.substring(idx - 150, idx + 150));
}

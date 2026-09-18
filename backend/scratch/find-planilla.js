const fs = require('fs');
const path = require('path');

const xml = fs.readFileSync(path.join(__dirname, 'xml_dump.xml'), 'utf8');

let idx = xml.indexOf("No. Planilla de aportes:");
if (idx !== -1) {
    console.log("=== No. Planilla de aportes: + 1000 chars context ===");
    console.log(xml.substring(idx - 100, idx + 1000));
} else {
    console.log("No. Planilla de aportes: not found!");
}

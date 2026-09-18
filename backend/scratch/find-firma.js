const fs = require('fs');
const path = require('path');

const xml = fs.readFileSync(path.join(__dirname, 'xml_dump.xml'), 'utf8');

let idx = xml.indexOf("FIRMA");
if (idx !== -1) {
    console.log("=== FIRMA + 1000 chars context ===");
    console.log(xml.substring(idx - 300, idx + 1000));
} else {
    console.log("FIRMA not found!");
}

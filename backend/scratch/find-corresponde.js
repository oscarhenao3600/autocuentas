const fs = require('fs');
const path = require('path');

const xml = fs.readFileSync(path.join(__dirname, 'xml_dump.xml'), 'utf8');

let idx = xml.indexOf("QUE CORRESPONDE A:");
if (idx !== -1) {
    console.log("=== QUE CORRESPONDE A: + 2000 chars context ===");
    console.log(xml.substring(idx - 100, idx + 2000));
} else {
    console.log("QUE CORRESPONDE A: not found!");
}

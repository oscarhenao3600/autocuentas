const fs = require('fs');
const path = require('path');

const xml = fs.readFileSync(path.join(__dirname, 'xml_dump.xml'), 'utf8');

let idxSalud = xml.indexOf("ssSalud");
if (idxSalud !== -1) {
    console.log("=== ssSalud row + 4500 chars context ===");
    console.log(xml.substring(idxSalud - 100, idxSalud + 4500));
} else {
    console.log("ssSalud not found!");
}

const fs = require('fs');
const path = require('path');

const xml = fs.readFileSync(path.join(__dirname, 'xml_dump.xml'), 'utf8');

function printContext(label, length = 500) {
    console.log(`\n=================== CONTEXT FOR: ${label} ===================`);
    let idx = xml.indexOf(label);
    if (idx === -1) {
        console.log(`NOT FOUND: ${label}`);
        return;
    }
    console.log(xml.substring(idx - 100, idx + length));
}

printContext("ENTIDAD");
printContext("SALDO");
printContext("ARL");
printContext("Por lo tanto");
printContext("CORRESPONDE");
printContext("Inicio:");

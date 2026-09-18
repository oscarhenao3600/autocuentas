const fs = require('fs');
const path = require('path');

const xml = fs.readFileSync(path.join(__dirname, 'xml_dump.xml'), 'utf8');

// Find all matches of autorizo
const regex = /autorizo/gi;
let match;
while ((match = regex.exec(xml)) !== null) {
    console.log(`\n=== Found "autorizo" match at position ${match.index} ===`);
    console.log(xml.substring(match.index - 100, match.index + 400));
}

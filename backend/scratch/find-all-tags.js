const fs = require('fs');
const path = require('path');

const xml = fs.readFileSync(path.join(__dirname, 'xml_dump.xml'), 'utf8');
let output = "=== SCANNING FOR ALL CURLY BRACES IN XML ===\n";

let pos = 0;
while ((pos = xml.indexOf('{', pos)) !== -1) {
    const endPos = xml.indexOf('}', pos);
    if (endPos === -1) {
        output += `Unmatched '{' at position ${pos}: ${xml.substring(pos, pos + 50)}\n`;
        pos++;
        continue;
    }
    const tagXmlSection = xml.substring(pos - 100, endPos + 100);
    output += `\nPosition ${pos} to ${endPos}:\n`;
    output += tagXmlSection + "\n";
    output += "--------------------------------------------------------------------------------\n";
    pos = endPos + 1;
}

fs.writeFileSync(path.join(__dirname, 'all_tags_contexts.txt'), output);
console.log("Wrote all tags contexts to scratch/all_tags_contexts.txt");

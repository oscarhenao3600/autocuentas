const fs = require('fs');
const path = require('path');

const xml = fs.readFileSync(path.join(__dirname, 'xml_dump.xml'), 'utf8');

// Find the start of the first paragraph
let p1StartIdx = xml.lastIndexOf("<w:p", xml.indexOf("QUE CORRESPONDE A:"));
// Find the end of that paragraph
let p1EndIdx = xml.indexOf("</w:p>", p1StartIdx) + 6;

// The second paragraph starts immediately or close after
let p2StartIdx = xml.indexOf("<w:p", p1EndIdx);
let p2EndIdx = xml.indexOf("</w:p>", p2StartIdx) + 6;

console.log("=== PARAGRAPH 1 ===");
console.log(xml.substring(p1StartIdx, p1EndIdx));

console.log("\n=== PARAGRAPH 2 ===");
console.log(xml.substring(p2StartIdx, p2EndIdx));

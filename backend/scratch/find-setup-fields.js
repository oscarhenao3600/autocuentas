const fs = require('fs');
const path = require('path');

const setupPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'ContractSetup.jsx');
const content = fs.readFileSync(setupPath, 'utf8');
const lines = content.split('\n');

console.log("=== Matches for 'supervisor' in ContractSetup.jsx ===");
lines.forEach((line, i) => {
    if (line.toLowerCase().includes("supervisor")) {
        console.log(`Line ${i + 1}: ${line.trim()}`);
    }
});

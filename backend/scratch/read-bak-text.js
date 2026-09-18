const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

async function readBak() {
    const filePath = path.join(__dirname, '..', 'templates', 'FORMATO CERTIFICADO DEL SUPERVISOR.docx.bak');
    if (!fs.existsSync(filePath)) {
        console.error("Backup not found!");
        process.exit(1);
    }
    try {
        const result = await mammoth.extractRawText({ path: filePath });
        fs.writeFileSync(path.join(__dirname, 'bak_text.txt'), result.value);
        console.log("Extracted backup text to scratch/bak_text.txt");
    } catch (e) {
        console.error(e);
    }
}

readBak();

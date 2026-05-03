const fs = require('fs');
const mammoth = require('mammoth');
const path = require('path');

async function extractText() {
    const filePath = path.join(__dirname, 'templates', 'FORMATO CERTIFICADO DEL SUPERVISOR.docx');
    try {
        const result = await mammoth.extractRawText({path: filePath});
        const text = result.value;
        fs.writeFileSync(path.join(__dirname, 'template_text.txt'), text);
        console.log("Extracted to template_text.txt");
    } catch (e) {
        console.error(e);
    }
}

extractText();

extractText();

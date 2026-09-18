const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

async function readLatestGenerated() {
    const genDir = path.join(__dirname, '..', 'generated');
    const files = fs.readdirSync(genDir)
        .filter(f => f.endsWith('FORMATO CERTIFICADO DEL SUPERVISOR.docx'))
        .map(f => ({
            name: f,
            time: fs.statSync(path.join(genDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
        console.error("No generated files found!");
        process.exit(1);
    }

    const latestFile = files[0].name;
    const filePath = path.join(genDir, latestFile);
    console.log(`Extracting text from: ${latestFile}`);

    try {
        const result = await mammoth.extractRawText({ path: filePath });
        fs.writeFileSync(path.join(__dirname, 'generated_text.txt'), result.value);
        console.log("Extracted to scratch/generated_text.txt");
    } catch (e) {
        console.error("Mammoth error:", e);
    }
}

readLatestGenerated();

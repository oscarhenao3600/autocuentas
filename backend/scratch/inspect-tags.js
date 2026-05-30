const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const inspectTags = (filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'binary');
        const zip = new PizZip(content);
        const docXml = zip.file('word/document.xml').asText();
        
        // Find all docxtemplater tags matching {anything} or {#anything} or {/anything}
        const matches = docXml.match(/\{[^}]+\}/g);
        if (matches) {
            const uniqueTags = [...new Set(matches)];
            console.log(`Tags in ${path.basename(filePath)}:`);
            console.log(uniqueTags);
        } else {
            console.log(`No tags found in ${path.basename(filePath)}`);
        }
    } catch (err) {
        console.error(`Error inspecting tags for ${filePath}:`, err.message);
    }
};

const templatesDir = path.resolve(__dirname, '..', 'templates');
inspectTags(path.join(templatesDir, 'CUENTA3', '1-CERTIFICADO DEL SUPERVISOR.docx'));
inspectTags(path.join(templatesDir, 'CUENTA3', '2-INFORME DE ACTIVIDADES.docx'));
inspectTags(path.join(templatesDir, 'CUENTA3', '4-RETENCION EN LA FUENTE.docx'));


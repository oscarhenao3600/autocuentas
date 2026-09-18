const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

const docxPath = path.join(__dirname, '..', 'templates', 'FORMATO DESCUENTO DE ESTAMPILLAS_CONVERTIDO.docx');

if (!fs.existsSync(docxPath)) {
    console.error("No existe el archivo docx.");
    process.exit(1);
}

mammoth.extractRawText({ path: docxPath })
    .then(result => {
        console.log("Texto extraído de la plantilla DOCX de estampillas:");
        console.log(result.value);
    })
    .catch(err => {
        console.error("Error al extraer texto:", err);
    });

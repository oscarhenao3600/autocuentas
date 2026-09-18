const fs = require('fs');
const path = require('path');

const doc3Path = path.join(__dirname, '..', 'templates', 'CUENTA3', '3-DESCUENTO DE ESTAMPILLAS.doc');
const doc2Path = path.join(__dirname, '..', 'templates', 'CUENTA2', '3-DESCUENTO DE ESTAMPILLAS.doc');

function inspectFile(filePath, label) {
    console.log(`\n=== Inspeccionando ${label}: ${filePath} ===`);
    if (!fs.existsSync(filePath)) {
        console.log("❌ Archivo no existe.");
        return;
    }
    const buffer = fs.readFileSync(filePath);
    const magic = buffer.toString('hex', 0, 4);
    console.log("Magic bytes (hex):", magic);
    if (magic === '504b0304') {
        console.log("📄 Es un archivo ZIP (formato DOCX renombrado a .doc).");
    } else if (magic === 'd0cf11e0') {
        console.log("💼 Es un archivo binario OLE (DOC antiguo de Word).");
    } else {
        console.log("❓ Formato desconocido.");
    }
    
    // Buscar y extraer textos legibles
    const asciiText = buffer.toString('ascii').replace(/[^ -~]/g, ' ');
    const uniqueStrings = new Set();
    // Encontrar secuencias de texto de más de 4 caracteres
    const matches = asciiText.match(/[a-zA-Z0-9_\-\.\:\/ ]{6,}/g) || [];
    console.log(`Total strings de texto legibles encontrados: ${matches.length}`);
    
    // Mostrar algunos textos interesantes
    console.log("Muestra de textos:");
    const interesting = matches.filter(s => {
        const trimmed = s.trim();
        return trimmed.includes('ESTAMPILLA') || trimmed.includes('Descuento') || trimmed.includes('2026') || trimmed.includes('Contratista') || trimmed.includes('Armenia');
    });
    console.log(interesting.slice(0, 15));
}

inspectFile(doc2Path, "CUENTA 2");
inspectFile(doc3Path, "CUENTA 3");
inspectFile(path.join(__dirname, '..', 'templates', 'FORMATO DESCUENTO DE ESTAMPILLAS.doc'), "PLANTILLA EN RAÍZ (.doc)");
inspectFile(path.join(__dirname, '..', 'templates', 'FORMATO DESCUENTO DE ESTAMPILLAS.docx'), "PLANTILLA EN RAÍZ (.docx)");

const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

function extractTagsFromDocx(filename) {
    const filePath = path.join(__dirname, 'templates', filename);
    const content = fs.readFileSync(filePath, 'binary');
    const zip = new PizZip(content);
    
    // El texto principal del docx está en word/document.xml
    const docXml = zip.file("word/document.xml");
    
    if (!docXml) {
        console.log("No se pudo encontrar document.xml en", filename);
        return;
    }
    
    const xmlText = docXml.asText();
    
    // Los tags en docxtemplater suelen verse como {variable} en el xml.
    // Sin embargo, Word a veces inserta etiquetas XML en medio de las llaves, 
    // por ejemplo {</w:t>...<w:t>variable}.
    // Para simplificar, primero removemos todas las etiquetas XML para dejar texto puro.
    const cleanText = xmlText.replace(/<[^>]+>/g, '');
    
    // Ahora buscamos patrones {algo}
    const tags = new Set();
    const regex = /\{([^}]+)\}/g;
    let match;
    
    while ((match = regex.exec(cleanText)) !== null) {
        tags.add(match[1].trim());
    }
    
    console.log(`\n--- Etiquetas (tags) encontradas en ${filename} ---`);
    if (tags.size === 0) {
        console.log("No se encontraron etiquetas con el formato {variable}. Verifica que las llaves estén correctas.");
    } else {
        tags.forEach(tag => console.log(`- {${tag}}`));
    }
    console.log("---------------------------------------------------\n");
}

extractTagsFromDocx('FORMATO CERTIFICADO DEL SUPERVISOR.docx');

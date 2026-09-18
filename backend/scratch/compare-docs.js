const fs = require('fs');
const path = require('path');

const doc2Path = path.join(__dirname, '..', 'templates', 'CUENTA2', '3-DESCUENTO DE ESTAMPILLAS.doc');
const doc3Path = path.join(__dirname, '..', 'templates', 'CUENTA3', '3-DESCUENTO DE ESTAMPILLAS.doc');

function cleanString(buffer) {
    // Reemplazar caracteres no imprimibles y colapsar espacios múltiples
    const text = buffer.toString('latin1');
    
    // Buscar los bloques principales de texto.
    // Dado que el formato .doc de Word 97-2003 tiene el texto en UTF-16LE o en codificación de 8 bits
    // vamos a buscar strings legibles largos.
    let cleaned = "";
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        if (charCode >= 32 && charCode <= 126 || charCode >= 192 && charCode <= 255 || charCode === 10 || charCode === 13) {
            cleaned += text.charAt(i);
        } else {
            cleaned += " ";
        }
    }
    // Colapsar espacios múltiples a un solo espacio
    return cleaned.replace(/\s+/g, ' ').trim();
}

const txt2 = cleanString(fs.readFileSync(doc2Path));
const txt3 = cleanString(fs.readFileSync(doc3Path));

console.log("=== TEXTO EXTRAÍDO CUENTA 2 ===");
console.log(txt2.substring(0, 1000));
console.log("\n=== TEXTO EXTRAÍDO CUENTA 3 ===");
console.log(txt3.substring(0, 1000));

// Comparar longitud e intentar buscar la diferencia exacta
if (txt2 === txt3) {
    console.log("\n✅ Los textos extraídos son exactamente idénticos.");
} else {
    console.log("\n❌ Los textos difieren.");
    // Encontrar dónde difieren
    let diffIndex = -1;
    for (let i = 0; i < Math.min(txt2.length, txt3.length); i++) {
        if (txt2[i] !== txt3[i]) {
            diffIndex = i;
            break;
        }
    }
    if (diffIndex !== -1) {
        console.log(`Difieren en la posición ${diffIndex}:`);
        console.log(`CUENTA 2: ...${txt2.substring(diffIndex - 30, diffIndex + 30)}...`);
        console.log(`CUENTA 3: ...${txt3.substring(diffIndex - 30, diffIndex + 30)}...`);
        
        // Buscar si hay más diferencias después
        const sub2 = txt2.substring(diffIndex + 15);
        const sub3 = txt3.substring(diffIndex + 15);
        // Ver si hay otra diferencia más adelante
        let nextDiff = -1;
        for (let j = 0; j < Math.min(sub2.length, sub3.length); j++) {
            if (sub2[j] !== sub3[j]) {
                nextDiff = j;
                break;
            }
        }
        if (nextDiff !== -1) {
            console.log(`Siguiente diferencia en la posición relativa ${nextDiff}:`);
            console.log(`CUENTA 2: ...${sub2.substring(nextDiff - 30, nextDiff + 30)}...`);
            console.log(`CUENTA 3: ...${sub3.substring(nextDiff - 30, nextDiff + 30)}...`);
        } else {
            console.log("No se encontraron más diferencias.");
        }
    }
}

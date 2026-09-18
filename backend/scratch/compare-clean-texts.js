const fs = require('fs');
const path = require('path');

const doc2Path = path.join(__dirname, '..', 'templates', 'CUENTA2', '3-DESCUENTO DE ESTAMPILLAS.doc');
const doc3Path = path.join(__dirname, '..', 'templates', 'CUENTA3', '3-DESCUENTO DE ESTAMPILLAS.doc');

function getReadableText(filePath) {
    const buffer = fs.readFileSync(filePath);
    let out = "";
    // Vamos a buscar caracteres legibles UTF-8 o latin1.
    // Buscamos rangos de caracteres imprimibles y acentos en español.
    for (let i = 0; i < buffer.length; i++) {
        const c = buffer[i];
        if (
            (c >= 32 && c <= 126) || // ASCII imprimible
            (c >= 192 && c <= 255) || // Vocales con tildes y ñ/Ñ
            c === 10 || c === 13 || c === 9 // saltos de línea y tabuladores
        ) {
            out += String.fromCharCode(c);
        } else {
            out += " ";
        }
    }
    // Limpiamos y colapsamos espacios, reemplazando caracteres extraños comunes
    return out
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")
        .replace(/\s+/g, ' ')
        .trim();
}

const text2 = getReadableText(doc2Path);
const text3 = getReadableText(doc3Path);

// Cortemos la cabecera binaria. Sabemos que el texto del documento empieza con "Armenia Quindío" o "Armenia"
const startWord = "Armenia Quindío";
const idx2 = text2.indexOf(startWord);
const idx3 = text3.indexOf(startWord);

const cleanText2 = idx2 !== -1 ? text2.substring(idx2) : text2;
const cleanText3 = idx3 !== -1 ? text3.substring(idx3) : text3;

console.log("CUENTA 2 TEXTO DE INTERÉS:");
console.log(cleanText2);
console.log("\nCUENTA 3 TEXTO DE INTERÉS:");
console.log(cleanText3);

if (cleanText2 === cleanText3) {
    console.log("\n✅ ¡Los textos legibles son 100% idénticos!");
} else {
    console.log("\n❌ Los textos legibles difieren.");
    let firstDiff = -1;
    for (let i = 0; i < Math.min(cleanText2.length, cleanText3.length); i++) {
        if (cleanText2[i] !== cleanText3[i]) {
            firstDiff = i;
            break;
        }
    }
    if (firstDiff !== -1) {
        console.log(`Diferencia en posición ${firstDiff}:`);
        console.log(`CUENTA 2: ...${cleanText2.substring(firstDiff - 40, firstDiff + 40)}...`);
        console.log(`CUENTA 3: ...${cleanText3.substring(firstDiff - 40, firstDiff + 40)}...`);
        
        // Buscar si hay otra diferencia más adelante
        const rest2 = cleanText2.substring(firstDiff + 10);
        const rest3 = cleanText3.substring(firstDiff + 10);
        let secondDiff = -1;
        for (let j = 0; j < Math.min(rest2.length, rest3.length); j++) {
            if (rest2[j] !== rest3[j]) {
                secondDiff = j;
                break;
            }
        }
        if (secondDiff !== -1) {
            console.log(`Siguiente diferencia:`);
            console.log(`CUENTA 2: ...${rest2.substring(secondDiff - 40, secondDiff + 40)}...`);
            console.log(`CUENTA 3: ...${rest3.substring(secondDiff - 40, secondDiff + 40)}...`);
        }
    }
}

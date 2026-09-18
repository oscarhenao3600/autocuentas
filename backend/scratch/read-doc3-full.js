const fs = require('fs');
const path = require('path');

const doc3Path = path.join(__dirname, '..', 'templates', 'CUENTA3', '3-DESCUENTO DE ESTAMPILLAS.doc');
const buffer = fs.readFileSync(doc3Path);

// Para extraer sólo las cadenas en español legibles
let text = "";
for (let i = 0; i < buffer.length; i++) {
    const c = buffer[i];
    if (
        (c >= 32 && c <= 126) || // ASCII
        (c >= 160 && c <= 255) || // Tildes y caracteres en español
        c === 10 || c === 13 || c === 9
    ) {
        text += String.fromCharCode(c);
    } else {
        text += " ";
    }
}

// Limpiar y formatear
const cleaned = text.replace(/\s+/g, ' ').trim();
const idx = cleaned.indexOf("Armenia Quindío");
if (idx !== -1) {
    console.log(cleaned.substring(idx, idx + 1500));
} else {
    console.log("No se encontró 'Armenia Quindío'. Texto completo cleaned:");
    console.log(cleaned.substring(0, 1500));
}

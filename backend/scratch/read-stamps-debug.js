const fs = require('fs');
const path = require('path');

const xmlPath = path.join(__dirname, 'stamps_debug.xml');
if (!fs.existsSync(xmlPath)) {
    console.error("No existe stamps_debug.xml");
    process.exit(1);
}

const xml = fs.readFileSync(xmlPath, 'utf8');

function checkField(query, label) {
    const idx = xml.indexOf(query);
    if (idx !== -1) {
        console.log(`✅ Campo '${label}' encontrado en XML. Alrededor:`);
        console.log(xml.substring(idx - 50, idx + 100));
    } else {
        console.log(`❌ Campo '${label}' NO encontrado (query: "${query}")`);
    }
}

checkField("JUAN PEREZ SANCHEZ", "Nombre Contratista");
checkField("1.094.123.456", "Cédula");
checkField("Carrera 18 # 2-75 Ed Las Terrazas Apto 301", "Dirección");
checkField("3113414361", "Teléfono");
checkField("Mayo 2026", "Fecha / Periodo");
checkField("[ X ]", "Checkbox Profesional");
checkField("[   ]", "Checkbox Apoyo");

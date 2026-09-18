const fs = require('fs');
const { exec } = require('child_process');

const paths = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
];

let found = false;
for (const p of paths) {
    if (fs.existsSync(p)) {
        console.log(`✅ Encontrado LibreOffice soffice en: ${p}`);
        found = true;
    }
}

if (!found) {
    console.log("LibreOffice soffice no se encontró en las rutas estándar.");
}

// Intentar correr soffice en la consola para ver si está en PATH
exec('soffice --version', (err, stdout, stderr) => {
    if (err) {
        console.log("soffice no está en el PATH.");
    } else {
        console.log("soffice en PATH:", stdout.trim());
    }
});

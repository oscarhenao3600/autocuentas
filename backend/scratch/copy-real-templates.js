const fs = require('fs');
const path = require('path');

const srcDir = `D:\\ALCALDIA DE ARMENIA\\CONTRATO_2026\\CUENTAS DE COBRO 2026 ALCALDIA\\FORMATOS PARA LA CUENTA DE COBRO`;
const destDir = `D:\\Desarollo\\FotmatosCuentas\\backend\\templates`;

function copyFile(name) {
    const src = path.join(srcDir, name);
    const dest = path.join(destDir, name);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`Copied ${name} successfully!`);
    } else {
        console.error(`Source template not found: ${src}`);
    }
}

copyFile('FORMATO CERTIFICADO DEL SUPERVISOR.docx');
copyFile('FORMATO DESCUENTO DE ESTAMPILLAS.doc');
copyFile('FORMATO INFORME DE ACTIVIDADES.docx');
copyFile('FORMATO RETENCION EN LA FUENTE.docx');

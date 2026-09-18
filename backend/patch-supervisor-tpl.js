const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const tplPath = path.join(__dirname, 'templates', 'FORMATO CERTIFICADO DEL SUPERVISOR.docx');
const backupPath = path.join(__dirname, 'templates', 'FORMATO CERTIFICADO DEL SUPERVISOR.docx.bak');

if (!fs.existsSync(tplPath)) {
    console.error("❌ Archivo plantilla no encontrado en:", tplPath);
    process.exit(1);
}

// 1. Create a backup of the original template if it does not exist
if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(tplPath, backupPath);
    console.log("💾 Backup original creado en:", backupPath);
}

// 2. Read clean XML from backup to ensure idempotency
console.log("Leyendo plantilla limpia desde el backup...");
const buffer = fs.readFileSync(backupPath);
const zip = new PizZip(buffer);
let xml = zip.file('word/document.xml').asText();

console.log("Aplicando parches globales de automatización en el XML...");

// 1. Cabezote: Reemplazar el run completo de Fecha, Supervisor y Dependencia
const headerTarget = '___/____/_____                                       __________________________________                   _______________________';
const headerReplacement = '{periodToDate}                                       {supervisorName}                   {supervisorDependency}';

if (xml.includes(headerTarget)) {
    xml = xml.replace(new RegExp(headerTarget.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), headerReplacement);
    console.log("✔ Cabezote (Fecha, Supervisor, Dependencia) parchado.");
} else {
    console.warn("⚠️ Advertencia: No se encontró el texto original del cabezote.");
}

// 2. Entidad Bancaria: replace split {paymentValue} with {bankName} globally
xml = xml.replace(/\{([^{}]*?)paymentValue([^{}]*?)\}/g, '{bankName}');

// 3. Saldo Restante: replace split {paymentMethod} next to SALDO RESTANTE with {remainingValue} globally
xml = xml.replace(/\{([^{}]*?)paymentMethod([^{}]*?)\}/g, '{remainingValue}');

// 4. Valor Autorizado: replace {} with $ {monthlyValue} globally
xml = xml.replace(/<w:t>\{\}<\/w:t>/g, '<w:t>$ {monthlyValue}</w:t>');

// 5. Forma de pago: replace __________________________ (after FORMA DE PAGO:) globally
xml = xml.replace(/<w:t>__________________________<\/w:t>/g, '<w:t>Transferencia Cuenta {paymentMethod} N. {accountNumber}</w:t>');

// 6. Periodo a pagar: replace ____________________________________________________________________________________ globally
xml = xml.replace(/<w:t>____________________________________________________________________________________<\/w:t>/g, '<w:t>Del {periodFrom} al {periodTo}</w:t>');

// 7. Pensión: replace $ ________ globally
xml = xml.replace(/<w:t>\$ ________<\/w:t>/g, '<w:t>$ {ssPension}</w:t>');

// 8. Salud: replace $ __________ globally
xml = xml.replace(/<w:t xml:space="preserve">\$ __________                                                               <\/w:t>/g, '<w:t>$ {ssSalud}</w:t>');

// 9. ARL: replace split ARL runs with clean ssArl tag globally
const arlTarget = `<w:t>AR</w:t></w:r><w:r w:rsidR="00D5515F" w:rsidRPr="002C69C8"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t>L</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t xml:space="preserve">:  </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t>$ ___________</w:t>`;
const arlReplacement = `<w:t>ARL</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t xml:space="preserve">:  $ {ssArl}</w:t>`;

// Replace all occurrences of the ARL XML pattern
let arlCount = 0;
while (xml.includes(arlTarget)) {
    xml = xml.replace(arlTarget, arlReplacement);
    arlCount++;
}
console.log(`✔ ARL parches XML aplicados (${arlCount} veces).`);

// 10. Planilla: add {ssPlanilla} next to 'No. Planilla de aportes:' globally
xml = xml.replace(/<w:t>No. Planilla de aportes:<\/w:t>/g, '<w:t>No. Planilla de aportes: {ssPlanilla}</w:t>');

// 11. Folios del informe globally
xml = xml.replace(/Informe del contratista: # de folios ___________/g, 'Informe del contratista: # de folios {foliosContratista}');
xml = xml.replace(/Informe del supervisor y\/o interventor: # de folios _____/g, 'Informe del supervisor y/o interventor: # de folios {foliosSupervisor}');

// 12. Autorizo pago mensualidad globally
xml = xml.replace(/ autorizo el pago por valor de: \$ __________________________/g, ' autorizo el pago por valor de: $ {monthlyValue}');

// 13. Correspondencia del pago: reemplazar todos los bloques de correspondencia de pago en un bucle seguro
let correspondeCount = 0;
let targetText = "QUE CORRESPONDE A: ANTICIPO";
let targetIndex;

while ((targetIndex = xml.indexOf(targetText)) !== -1) {
    let p1Start = xml.lastIndexOf("<w:p", targetIndex);
    while (p1Start !== -1 && xml.substring(p1Start, p1Start + 6).startsWith("<w:pPr")) {
        p1Start = xml.lastIndexOf("<w:p", p1Start - 1);
    }
    
    const p1End = xml.indexOf("</w:p>", targetIndex) + 6;
    const p2Start = xml.indexOf("<w:p", p1End);
    const p2End = xml.indexOf("</w:p>", p2Start) + 6;

    if (p1Start !== -1 && p1End !== 5 && p2Start !== -1 && p2End !== 5) {
        const replacementSection = `<w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>QUE CORRESPONDE AL PAGO: {actNumberText} (Acta N. {actNumber})</w:t></w:r></w:p>`;
        xml = xml.substring(0, p1Start) + replacementSection + xml.substring(p2End);
        correspondeCount++;
    } else {
        break;
    }
}
console.log(`✔ Párrafos de correspondencia de pago reemplazados (${correspondeCount} veces).`);

// 14. Firma del Supervisor: centrar nombre del supervisor debajo de la línea y texto de firma globally
const signatureTarget = `<w:t xml:space="preserve">FIRMA DEL </w:t></w:r><w:r w:rsidR="002C69C8"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>SUPERVISOR Y</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">/O INTERVENTOR </w:t></w:r>`;
const signatureReplacement = `<w:t>FIRMA DEL SUPERVISOR Y/O INTERVENTOR</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:br/><w:t>{supervisorName}</w:t></w:r>`;

let signatureCount = 0;
while (xml.includes(signatureTarget)) {
    xml = xml.replace(signatureTarget, signatureReplacement);
    signatureCount++;
}
console.log(`✔ Bloque de firma del supervisor configurado con salto de línea (${signatureCount} veces).`);

// Save the patched XML back to ZIP
zip.file('word/document.xml', xml);
const outBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(tplPath, outBuf);

console.log("🎉 Plantilla del certificado del supervisor automatizada con éxito en:", tplPath);

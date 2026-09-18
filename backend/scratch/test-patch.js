const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const docxtemplater = require('docxtemplater');

// 1. Read clean backup of template
const originalPath = path.join(__dirname, '..', 'templates', 'FORMATO CERTIFICADO DEL SUPERVISOR.docx.bak');
if (!fs.existsSync(originalPath)) {
    console.error("Backup file FORMATO CERTIFICADO DEL SUPERVISOR.docx.bak not found!");
    process.exit(1);
}

const buffer = fs.readFileSync(originalPath);
const zip = new PizZip(buffer);
let xml = zip.file('word/document.xml').asText();

console.log("=== PATCHING XML ===");

// A. CDP and RP tags: already present in template as {cdp} and {rp}.
// B. Clean split {paymentValue} (Entidad Bancaria) and replace with {bankName}
xml = xml.replace(/\{<\/w:t>([\s\S]*?)paymentValue<\/w:t>([\s\S]*?)\}/g, '{bankName}');

// C. Clean split {paymentMethod} (Saldo Restante) and replace with {remainingValue}
xml = xml.replace(/\{<\/w:t>([\s\S]*?)paymentMethod<\/w:t>([\s\S]*?)\}/g, '{remainingValue}');

// D. Valor Autorizado: replace {} with $ {monthlyValue}
xml = xml.replace('<w:t>{}</w:t>', '<w:t>$ {monthlyValue}</w:t>');

// E. ARL: replace split ARL runs with clean ssArl tag
const arlTarget = `<w:t>AR</w:t></w:r><w:r w:rsidR="00D5515F" w:rsidRPr="002C69C8"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t>L</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t xml:space="preserve">:  </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t>$ ___________</w:t>`;
const arlReplacement = `<w:t>ARL</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t xml:space="preserve">:  $ {ssArl}</w:t>`;
if (xml.includes(arlTarget)) {
    xml = xml.replace(arlTarget, arlReplacement);
    console.log("✔ ARL patched successfully.");
} else {
    console.warn("⚠️ ARL target XML not found!");
}

// F. Planilla: add {ssPlanilla} next to 'No. Planilla de aportes:'
xml = xml.replace('<w:t>No. Planilla de aportes:</w:t>', '<w:t>No. Planilla de aportes: {ssPlanilla}</w:t>');

// G. Monthly Value authorization line: replace underlines with {monthlyValue}
xml = xml.replace(' autorizo el pago por valor de: $ __________________________', ' autorizo el pago por valor de: $ {monthlyValue}');

// H. Que Corresponde A paragraphs replacement: replace both paragraphs
const targetText = "QUE CORRESPONDE A: ANTICIPO";
const p1Start = xml.lastIndexOf("<w:p ", xml.indexOf(targetText));
const p2End = xml.indexOf("</w:p>", xml.indexOf("_ CUAL: __________________________________________________")) + 6;

if (p1Start !== -1 && p2End !== -1) {
    const originalSection = xml.substring(p1Start, p2End);
    const replacementSection = `<w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>QUE CORRESPONDE AL PAGO: {actNumberText} (Acta N. {actNumber})</w:t></w:r></w:p>`;
    xml = xml.substring(0, p1Start) + replacementSection + xml.substring(p2End);
    console.log("✔ Que Corresponde A paragraphs patched successfully.");
} else {
    console.warn("⚠️ Que Corresponde A target paragraph indices not found!");
}

// I. Firma del Supervisor: append name under signature line
const signatureTarget = `<w:t xml:space="preserve">FIRMA DEL </w:t></w:r><w:r w:rsidR="002C69C8"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>SUPERVISOR Y</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">/O INTERVENTOR </w:t>`;

const signatureReplacement = `<w:t>FIRMA DEL SUPERVISOR Y/O INTERVENTOR</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>{supervisorName}</w:t></w:r>`;

if (xml.includes(signatureTarget)) {
    xml = xml.replace(signatureTarget, signatureReplacement);
    console.log("✔ Signature block patched successfully.");
} else {
    console.warn("⚠️ Signature block target not found!");
}

// Write the patched XML back to a new zip file in scratch
zip.file('word/document.xml', xml);
const outBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
const testTplPath = path.join(__dirname, 'test_patched_template.docx');
fs.writeFileSync(testTplPath, outBuf);
console.log("Patched test template written to scratch/test_patched_template.docx");

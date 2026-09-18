const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const tplPath = path.join(__dirname, 'templates', 'FORMATO DESCUENTO DE ESTAMPILLAS.docx');
const cleanTplPath = path.join(__dirname, 'templates', 'FORMATO DESCUENTO DE ESTAMPILLAS_CONVERTIDO.docx');

if (!fs.existsSync(cleanTplPath)) {
    console.error("❌ Archivo base convertido no encontrado en:", cleanTplPath);
    process.exit(1);
}

console.log("Leyendo plantilla limpia de estampillas...");
const buffer = fs.readFileSync(cleanTplPath);
const zip = new PizZip(buffer);
let xml = zip.file('word/document.xml').asText();

console.log("Aplicando parches XML sobre el formato oficial...");

// 1. Ciudad y fecha
// Reemplazar desde "Ciudad y fecha:" hasta el fin de su párrafo
xml = xml.replace(/<w:t[^>]*?>Ciudad y fecha:\s*?<\/w:t>[^]*?<\/w:p>/, '<w:t>Ciudad y fecha: Armenia Quindío, {periodMonthYear}</w:t></w:r></w:p>');

// 2. Nombre y Apellido
// Reemplazar desde "Nombre y Apellido" hasta antes de "Cédula"
xml = xml.replace(/<w:t[^>]*?>Nombre y Apellido\s*?<\/w:t>[^]*?Cédula/g, '<w:t>Nombre y Apellido: {contractorName}  </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr><w:t>Cédula');

// 3. Cédula
// Reemplazar desde "Cédula" hasta el final de su párrafo
xml = xml.replace(/<w:t[^>]*?>Cédula\s*?<\/w:t>[^]*?<\/w:p>/g, '<w:t>Cédula: {idNumber}</w:t></w:r></w:p>');

// 4. Dirección
// Reemplazar desde "Dirección" hasta antes de "Teléfono"
xml = xml.replace(/<w:t[^>]*?>Dirección\s*?<\/w:t>[^]*?Teléfono/g, '<w:t>Dirección: {contractorAddress}  </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr><w:t>Teléfono');

// 5. Teléfono
// Reemplazar desde "Teléfono" hasta el final de su párrafo
xml = xml.replace(/<w:t[^>]*?>Teléfono\s*?<\/w:t>[^]*?<\/w:p>/g, '<w:t>Teléfono: {contractorPhone}</w:t></w:r></w:p>');

// 6. Checkboxes de Tipo de Contrato
// Usar los placeholders de docxtemplater antes del texto de las opciones principales
xml = xml.replace(/<w:t[^>]*?>Prestación de Servicios Apoyo a la Gestión\s*?<\/w:t>/g, '<w:t xml:space="preserve">{chkApoyo} Prestación de Servicios Apoyo a la Gestión</w:t>');
xml = xml.replace(/<w:t[^>]*?>Prestación de Servicios Profesionales\s*?<\/w:t>/g, '<w:t xml:space="preserve">{chkProfesional} Prestación de Servicios Profesionales</w:t>');
xml = xml.replace(/<w:t[^>]*?>Contratos de Obra\s*?<\/w:t>/g, '<w:t xml:space="preserve">{chkObra} Contratos de Obra</w:t>');
xml = xml.replace(/<w:t[^>]*?>Contratos de Consultoría\s*?<\/w:t>/g, '<w:t xml:space="preserve">{chkConsultoria} Contratos de Consultoría</w:t>');
xml = xml.replace(/<w:t[^>]*?>Compra Venta y\/o Suministros\s*?<\/w:t>/g, '<w:t xml:space="preserve">{chkSuministros} Compra Venta y/o Suministros</w:t>');
xml = xml.replace(/<w:t[^>]*?>Proveedor\s*?<\/w:t>/g, '<w:t xml:space="preserve">{chkProveedor} Proveedor</w:t>');
xml = xml.replace(/<w:t[^>]*?>Otro\s*?<\/w:t>/g, '<w:t xml:space="preserve">{chkOtro} Otro</w:t>');

// 7. Firma
// Reemplazar "Nombre y Apellido" de la firma (la regex global reemplazará ambos, pero la primera ya fue reemplazada en paso 2. Queda la segunda al final de la firma)
xml = xml.replace(/<w:t[^>]*?>Nombre y Apellido\s*?<\/w:t>/g, '<w:t>{contractorName}</w:t>');
// Reemplazar "C.C. "
xml = xml.replace(/<w:t[^>]*?>C\.C\.\s*?<\/w:t>/g, '<w:t xml:space="preserve">C.C. {idNumber}</w:t>');

// Escribir el xml modificado en el zip
zip.file('word/document.xml', xml);
const outBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(tplPath, outBuf);

console.log("🎉 Plantilla oficial de descuento de estampillas automatizada con éxito en:", tplPath);

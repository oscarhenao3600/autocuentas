/**
 * create-templates.js
 * Genera las plantillas Word (.docx) con etiquetas docxtemplater
 * usando PizZip (ya instalado) + XML puro.
 *
 * Ejecutar: node create-templates.js
 */

const PizZip = require('pizzip');
const fs     = require('fs');
const path   = require('path');

const TEMPLATES_DIR = path.join(__dirname, 'templates');

// ─────────────────────────────────────────────────────────────────────────────
// Minimal valid DOCX XML skeleton
// ─────────────────────────────────────────────────────────────────────────────
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"   ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const WORD_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
</w:styles>`;

// ─────────────────────────────────────────────────────────────────────────────
// XML helpers
// ─────────────────────────────────────────────────────────────────────────────
function para(text, { bold = false, center = false, size = 24 } = {}) {
    const jc   = center ? `<w:jc w:val="center"/>` : '';
    const bTag = bold   ? `<w:b/>` : '';
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return `<w:p>
    <w:pPr>${jc}<w:spacing w:after="80"/></w:pPr>
    <w:r><w:rPr>${bTag}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>
  </w:p>`;
}

function blank() {
    return `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>`;
}

function hr() {
    return para('─────────────────────────────────────────────────────────────────────');
}

function buildDoc(paragraphs) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphs.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1701" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Write .docx file
// ─────────────────────────────────────────────────────────────────────────────
function writeDocx(filename, documentXml) {
    const zip = new PizZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES);
    zip.file('_rels/.rels', RELS);
    zip.file('word/_rels/document.xml.rels', WORD_RELS);
    zip.file('word/styles.xml', STYLES);
    zip.file('word/document.xml', documentXml);

    const outPath = path.join(TEMPLATES_DIR, filename);
    const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(outPath, buf);
    console.log('✅ Plantilla creada:', filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. FORMATO INFORME DE ACTIVIDADES
// ─────────────────────────────────────────────────────────────────────────────
function createInformeActividades() {
    const ps = [
        para('ALCALDÍA DE ARMENIA – QUINDÍO', { bold: true, center: true, size: 28 }),
        para('SECRETARÍA DE PLANEACIÓN', { bold: true, center: true, size: 26 }),
        blank(),
        para('INFORME MENSUAL DE ACTIVIDADES', { bold: true, center: true, size: 28 }),
        blank(),
        para('Contratista:      {contractorName}',  { bold: false }),
        para('Cédula / NIT:     {idNumber}',         { bold: false }),
        para('No. Contrato:     {contractNumber}',   { bold: false }),
        para('Tipo:             {contractType}',     { bold: false }),
        para('Objeto:           {contractObject}',   { bold: false }),
        para('Período:          {periodFrom}  al  {periodTo}', { bold: false }),
        para('Mes / Año:        {mes} / {anio}',     { bold: false }),
        para('No. de Acta:      {actNumber}',        { bold: false }),
        blank(),
        para('RELACIÓN DE ACTIVIDADES DESARROLLADAS', { bold: true }),
        blank(),

        // ── Docxtemplater loop – one block per activity ──────────────────────
        // The {#activities} ... {/activities} tags MUST appear as plain text
        // in separate runs for docxtemplater to parse them.
        para('{#activities}'),
        para('Obligación {num}  |  Código: {obligationCode}', { bold: true }),
        para('Descripción de la obligación:'),
        para('{obligationText}'),
        para('Actividad / comentario del contratista:'),
        para('{comment}'),
        hr(),
        para('{/activities}'),

        blank(),
        para('APORTES A SEGURIDAD SOCIAL DEL MES', { bold: true }),
        para('Operador:         {ssOperator}'),
        para('Número planilla:  {ssPlanilla}'),
        para('Período cotizado: {ssPeriod}'),
        para('Total pagado:   $ {ssTotalPaid}'),
        para('  • Salud:      $ {ssSalud}'),
        para('  • Pensión:    $ {ssPension}'),
        para('  • ARL:        $ {ssArl}'),
        blank(),
        para('___________________________________       ___________________________________', { center: true }),
        para('      {contractorName}                         {supervisorName}', { center: true }),
        para('      Contratista                              Supervisor del Contrato', { center: true }),
    ];
    writeDocx('FORMATO INFORME DE ACTIVIDADES.docx', buildDoc(ps));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FORMATO RETENCIÓN EN LA FUENTE
// ─────────────────────────────────────────────────────────────────────────────
function createRetencionFuente() {
    const ps = [
        para('ALCALDÍA DE ARMENIA – QUINDÍO', { bold: true, center: true, size: 28 }),
        para('SECRETARÍA DE PLANEACIÓN', { bold: true, center: true, size: 26 }),
        blank(),
        para('RETENCIÓN EN LA FUENTE', { bold: true, center: true, size: 28 }),
        blank(),
        para('Contratista:         {contractorName}'),
        para('Cédula / NIT:        {idNumber}'),
        para('No. Contrato:        {contractNumber}'),
        para('Tipo de Contrato:    {contractType}'),
        para('Mes de Liquidación:  {mes} / {anio}'),
        para('No. de Acta:         {actNumber}'),
        blank(),
        para('VALORES PARA RETENCIÓN', { bold: true }),
        para('Valor mensual del contrato:              $ {monthlyValue}'),
        para('   (En letras: {monthlyValueWord})'),
        para('Ingreso Base de Cotización – IBC (40%):  $ {ibcValue}'),
        para('Seguridad Social total pagada:           $ {ssTotalPaid}'),
        para('   • Salud   (12.5 %):                   $ {ssSalud}'),
        para('   • Pensión (16 %):                     $ {ssPension}'),
        para('   • ARL:                                $ {ssArl}'),
        blank(),
        para('DATOS DE IDENTIFICACIÓN PRESUPUESTAL', { bold: true }),
        para('Supervisor del Contrato: {supervisorName}'),
        para('RP No.:                  {rpNumber}'),
        para('CDP No.:                 {cdpNumber}'),
        para('Rubro Presupuestal:      {rubro}'),
        blank(),
        para('___________________________________       ___________________________________', { center: true }),
        para('      {contractorName}                         {supervisorName}', { center: true }),
        para('      Contratista                              Supervisor del Contrato', { center: true }),
    ];
    writeDocx('FORMATO RETENCION EN LA FUENTE.docx', buildDoc(ps));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FORMATO DESCUENTO DE ESTAMPILLAS
// ─────────────────────────────────────────────────────────────────────────────
function createDescuentoEstampillas() {
    const ps = [
        para('ALCALDÍA DE ARMENIA – QUINDÍO', { bold: true, center: true, size: 28 }),
        para('SECRETARÍA DE HACIENDA MUNICIPAL', { bold: true, center: true, size: 26 }),
        blank(),
        para('AUTORIZACIÓN DESCUENTO DE ESTAMPILLAS', { bold: true, center: true, size: 28 }),
        blank(),
        para('Ciudad y Fecha: Armenia, {periodTo}'),
        blank(),
        para('Señores:'),
        para('SECRETARÍA DE HACIENDA MUNICIPAL'),
        para('Municipio de Armenia'),
        blank(),
        para('Asunto: Autorización Descuento de Estampillas'),
        blank(),
        para('Yo, {contractorName}, identificado con la Cédula de Ciudadanía N° {idNumber}, autorizo de manera expresa y voluntaria al Municipio de Armenia para que realice los respectivos descuentos por concepto de estampillas (Pro-Desarrollo, Pro-Hospital, Pro-Cultura, Pro-Bienestar del Adulto Mayor) que se lleguen a causar con ocasión de la ejecución de mi contrato N° {contractNumber} de tipo {contractType}, cuyo objeto es: {contractObject}.'),
        blank(),
        para('Los descuentos de estampillas autorizados corresponden al Acta de cobro N° {actNumber} del periodo comprendido entre el {periodFrom} y el {periodTo}.'),
        blank(),
        blank(),
        para('Atentamente,'),
        blank(),
        blank(),
        para('___________________________________', { center: true }),
        para('{contractorName}', { bold: true, center: true }),
        para('C.C. N° {idNumber}', { center: true }),
        para('Contratista', { center: true })
    ];
    writeDocx('FORMATO DESCUENTO DE ESTAMPILLAS.docx', buildDoc(ps));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔨 Generando plantillas Word con etiquetas docxtemplater...\n');
createInformeActividades();
createRetencionFuente();
createDescuentoEstampillas();
console.log('\n✅ Listo. Plantillas guardadas en:', TEMPLATES_DIR);

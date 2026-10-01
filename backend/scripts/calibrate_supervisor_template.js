const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

function calibrateSupervisorTemplate() {
    const tplPath = path.resolve(__dirname, '../templates/FORMATO CERTIFICADO DEL SUPERVISOR.docx');
    const zip = new PizZip(fs.readFileSync(tplPath));
    let xml = zip.file('word/document.xml').asText();

    // 1. Fix single bracket / broken tags
    xml = xml.replace(/\{nombre_supervisor[^}]*\}+/g, '{{nombre_supervisor}}');
    xml = xml.replace(/\{dependencia[^}]*\}+/g, '{{dependencia}}');
    xml = xml.replace(/\{cdp[^}]*\}+/g, '{{cdp}}');
    xml = xml.replace(/\{rp[^}]*\}+/g, '{{rp}}');
    xml = xml.replace(/\{\{fecha_certificado[^}]*\}+/g, '{{fecha_certificado}}');

    // 2. Fix Checkboxes spacing
    xml = xml.replace(/PRIMERO\{\{chk_primero\}\}/g, 'PRIMERO {{chk_primero}}');
    xml = xml.replace(/SEGUNDO\{\{chk_segundo\}\}/g, 'SEGUNDO {{chk_segundo}}');
    xml = xml.replace(/TERCERO\{\{chk_tercero\}\}/g, 'TERCERO {{chk_tercero}}');
    xml = xml.replace(/CUARTO\{\{chk_cuarto\}\}/g, 'CUARTO {{chk_cuarto}}');
    xml = xml.replace(/QUINTO\{\{chk_quinto\}\}/g, 'QUINTO {{chk_quinto}}');
    xml = xml.replace(/SEXTO\{\{chk_sexto\}\}/g, 'SEXTO {{chk_sexto}}');
    xml = xml.replace(/SEPTIMO\{\{chk_septimo\}\}/g, 'SEPTIMO {{chk_septimo}}');
    xml = xml.replace(/OCTAVO\{\{chk_octavo\}\}/g, 'OCTAVO {{chk_octavo}}');
    xml = xml.replace(/NOVENO\{\{chk_noveno\}\}/g, 'NOVENO {{chk_noveno}}');
    xml = xml.replace(/OTROS\{\{chk_otros\}\}/g, 'OTROS {{chk_otros}}');

    // 3. Fix supports section
    const sStart = xml.indexOf('Acta de Inicio');
    const pStart = xml.lastIndexOf('<w:p ', sStart);
    const pEnd = xml.indexOf('</w:tc></w:tr>', sStart);

    // Read the exact 10 support paragraphs from the approved document
    const appPath = 'C:/Users/OSCAR_PC/Desktop/Documentos 2026-03/CUENTA 1/1-CERTIFICADO DEL SUPERVISOR.docx';
    const appZip = new PizZip(fs.readFileSync(appPath));
    const appXml = appZip.file('word/document.xml').asText();
    const appStart = appXml.indexOf('Acta de Inicio');
    const appPStart = appXml.lastIndexOf('<w:p ', appStart);
    const appPEnd = appXml.indexOf('</w:tc></w:tr>', appStart);

    let approvedSupportsXml = appXml.substring(appPStart, appPEnd);

    // Inject dynamic tags into the approved supports XML
    // 1. Acta de inicio
    approvedSupportsXml = approvedSupportsXml.replace(
        'Acta de Inicio (solo la primera vez): 1 folio(s).',
        'Acta de Inicio (solo la primera vez): {{soporte_acta_inicio_folios}} folio(s).'
    );
    // 2. Informe contratista
    approvedSupportsXml = approvedSupportsXml.replace(
        /<w:t>2<\/w:t>/,
        '<w:t>{{soporte_informe_contratista_folios}}</w:t>'
    );
    // 3. Informe supervisor
    approvedSupportsXml = approvedSupportsXml.replace(
        /<w:t>1<\/w:t>/,
        '<w:t>{{soporte_informe_supervisor_folios}}</w:t>'
    );

    // Replace in template xml
    xml = xml.substring(0, pStart) + approvedSupportsXml + xml.substring(pEnd);

    zip.file('word/document.xml', xml);
    const newBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(tplPath, newBuf);
    console.log('Successfully calibrated FORMATO CERTIFICADO DEL SUPERVISOR.docx');
}

calibrateSupervisorTemplate();

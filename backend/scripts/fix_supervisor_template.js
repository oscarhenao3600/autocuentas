const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

function fixSupervisorTemplate() {
    const tplPath = path.resolve(__dirname, '../templates/FORMATO CERTIFICADO DEL SUPERVISOR.docx');
    const zip = new PizZip(fs.readFileSync(tplPath));
    let xml = zip.file('word/document.xml').asText();

    // 1. Fix broken XML runs for the 5 tags: fecha_certificado, nombre_supervisor, dependencia, cdp, rp
    // Fecha certificado
    xml = xml.replace(
        /<w:t>\{\{fecha_certificado<\/w:t><\/w:r><w:proofErr w:type="gramStart"\/><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"\/><w:sz w:val="18"\/><w:szCs w:val="18"\/><\/w:rPr><w:t xml:space="preserve">\}\}<\/w:t><\/w:r>/,
        '<w:t>{{fecha_certificado}}</w:t></w:r>'
    );

    // Nombre supervisor
    xml = xml.replace(
        /<w:t xml:space="preserve">   \{<\/w:t><\/w:r><w:proofErr w:type="gramEnd"\/><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"\/><w:sz w:val="18"\/><w:szCs w:val="18"\/><\/w:rPr><w:t>\{nombre_supervisor<\/w:t><\/w:r><w:proofErr w:type="gramStart"\/><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"\/><w:sz w:val="18"\/><w:szCs w:val="18"\/><\/w:rPr><w:t xml:space="preserve">\}\}<\/w:t><\/w:r>/,
        '<w:t>{{nombre_supervisor}}</w:t></w:r>'
    );

    // Dependencia
    xml = xml.replace(
        /<w:t xml:space="preserve">   \{<\/w:t><\/w:r><w:proofErr w:type="gramEnd"\/><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"\/><w:sz w:val="18"\/><w:szCs w:val="18"\/><\/w:rPr><w:t>\{dependencia\}\}<\/w:t><\/w:r>/,
        '<w:t>{{dependencia}}</w:t></w:r>'
    );

    // CDP
    xml = xml.replace(
        /<w:t>\{<\/w:t><\/w:r><w:proofErr w:type="gramEnd"\/><w:r w:rsidRPr="00ED0BF3"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"\/><w:i\/><w:sz w:val="18"\/><w:szCs w:val="18"\/><w:u w:val="single"\/><\/w:rPr><w:t>\{cdp<\/w:t><\/w:r><w:proofErr w:type="gramStart"\/><w:r w:rsidRPr="00ED0BF3"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"\/><w:i\/><w:sz w:val="18"\/><w:szCs w:val="18"\/><w:u w:val="single"\/><\/w:rPr><w:t>\}\}<\/w:t><\/w:r>/,
        '<w:t>{{cdp}}</w:t></w:r>'
    );

    // RP
    xml = xml.replace(
        /<w:t xml:space="preserve"> \{<\/w:t><\/w:r><w:proofErr w:type="gramEnd"\/><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"\/><w:i\/><w:sz w:val="18"\/><w:szCs w:val="18"\/><w:u w:val="single"\/><\/w:rPr><w:t>\{rp<\/w:t><\/w:r><w:proofErr w:type="gramStart"\/><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"\/><w:i\/><w:sz w:val="18"\/><w:szCs w:val="18"\/><w:u w:val="single"\/><\/w:rPr><w:t>\}\}<\/w:t><\/w:r>/,
        '<w:t>{{rp}}</w:t></w:r>'
    );

    // 2. Fix checkboxes spacing
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

    // 3. Fix supports section rows
    // Replace:
    // Informe del contratista: # de folios {{soporte_informe_contratista_folios}} 
    // Informe del supervisor y/o interventor: # de folios {{soporte_informe_supervisor_folios}}
    // Otros: {{soportes_otros}}
    // With the approved 10-item paragraph list:
    const oldSupportsSectionRegex = /<w:p [^>]*paraId="05981C42"[\s\S]*?Otros: \{\{soportes_otros\}\}<\/w:t><\/w:r><\/w:p>/;
    
    const approvedSupportsXml = 
        '<w:p w14:paraId="05981C42" w14:textId="35009277" w:rsidR="0065609B" w:rsidRPr="009E39D1" w:rsidRDefault="0065609B" w:rsidP="009E39D1"><w:pPr><w:pStyle w:val="Ttulo5"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:ind w:left="714" w:hanging="357"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b w:val="0"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r w:rsidRPr="009E39D1"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b w:val="0"/><w:szCs w:val="18"/><w:lang w:val="es-ES"/></w:rPr><w:t xml:space="preserve">Informe del contratista: {{soporte_informe_contratista_folios}} folio(s).</w:t></w:r></w:p>' +
        '<w:p w14:paraId="3780B49E" w14:textId="7B8E0C25" w:rsidR="0065609B" w:rsidRPr="009E39D1" w:rsidRDefault="0065609B" w:rsidP="009E39D1"><w:pPr><w:pStyle w:val="Ttulo5"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:ind w:left="714" w:hanging="357"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b w:val="0"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r w:rsidRPr="009E39D1"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b w:val="0"/><w:szCs w:val="18"/></w:rPr><w:t>Informe del supervisor y/o interventor: {{soporte_informe_supervisor_folios}} folio(s).</w:t></w:r></w:p>' +
        '<w:p w14:paraId="29C5C7D6" w14:textId="4DCBFDE2" w:rsidR="009E39D1" w:rsidRPr="009E39D1" w:rsidRDefault="0065609B" w:rsidP="009E39D1"><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr></w:pPr><w:r w:rsidRPr="009E39D1"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO"/></w:rPr><w:t>Planilla de Seguridad Social: {{soporte_planilla_folios}} folio(s).</w:t></w:r></w:p>' +
        '<w:p w14:paraId="42EA73DB" w14:textId="24282903" w:rsidR="009E39D1" w:rsidRPr="009E39D1" w:rsidRDefault="009E39D1" w:rsidP="009E39D1"><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr></w:pPr><w:r w:rsidRPr="009E39D1"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO"/></w:rPr><w:t>Recibo de pago: {{soporte_recibo_folios}} folio(s)</w:t></w:r></w:p>' +
        '<w:p w14:paraId="16BDD4CF" w14:textId="78773485" w:rsidR="009E39D1" w:rsidRPr="009E39D1" w:rsidRDefault="0065609B" w:rsidP="009E39D1"><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr></w:pPr><w:r w:rsidRPr="009E39D1"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO"/></w:rPr><w:t>RUT: 1 folio(s)</w:t></w:r></w:p>' +
        '<w:p w14:paraId="0835CEED" w14:textId="480F3A6A" w:rsidR="0065609B" w:rsidRPr="009E39D1" w:rsidRDefault="0065609B" w:rsidP="009E39D1"><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr></w:pPr><w:r w:rsidRPr="009E39D1"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO"/></w:rPr><w:t>Certificación Bancaria: 1 folio(s)</w:t></w:r></w:p>' +
        '<w:p w14:paraId="5F573DC7" w14:textId="531D5523" w:rsidR="009E39D1" w:rsidRPr="009E39D1" w:rsidRDefault="009E39D1" w:rsidP="009E39D1"><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr></w:pPr><w:r w:rsidRPr="009E39D1"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO"/></w:rPr><w:t>Descuento de Estampillas 1 folio(s)</w:t></w:r></w:p>' +
        '<w:p w14:paraId="77F0E197" w14:textId="7C00EEE9" w:rsidR="009E39D1" w:rsidRPr="009E39D1" w:rsidRDefault="009E39D1" w:rsidP="009E39D1"><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr></w:pPr><w:r w:rsidRPr="009E39D1"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO"/></w:rPr><w:t>Retención en la Fuente: 1 folio(s)</w:t></w:r></w:p>' +
        '<w:p w14:paraId="5F9DE46B" w14:textId="3201D971" w:rsidR="009E39D1" w:rsidRDefault="009E39D1" w:rsidP="009E39D1"><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr></w:pPr><w:r w:rsidRPr="009E39D1"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t>RP: 1 folio(s)</w:t></w:r></w:p>';

    xml = xml.replace(oldSupportsSectionRegex, approvedSupportsXml);

    zip.file('word/document.xml', xml);
    const newBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(tplPath, newBuf);
    console.log('Successfully fixed FORMATO CERTIFICADO DEL SUPERVISOR.docx');
}

fixSupervisorTemplate();

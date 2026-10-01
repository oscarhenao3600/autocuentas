const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

function createPerfectSupervisorTemplate() {
    const srcPath = 'C:/Users/OSCAR_PC/Desktop/Documentos 2026-03/CUENTA 1/1-CERTIFICADO DEL SUPERVISOR.docx';
    const tplPath = path.resolve(__dirname, '../templates/FORMATO CERTIFICADO DEL SUPERVISOR.docx');

    const zip = new PizZip(fs.readFileSync(srcPath));
    let xml = zip.file('word/document.xml').asText();

    // 1. Remove the supervisor signature graphic from paragraph 49
    xml = xml.replace(/<w:drawing>[\s\S]*?<\/w:drawing>/g, '');

    // 2. Replace paragraph 5 (fecha_certificado, supervisor, dependencia)
    const p5Old = xml.match(/<w:p\b[^>]*>[\s\S]*?30 - 09 - 2026[\s\S]*?ANDRES FELIPE BARRERA PEREZ[\s\S]*?<\/w:p>/);
    if (p5Old) {
        const p5New = 
            '<w:p w14:paraId="347B00C0" w14:textId="77777777" w:rsidR="0065609B" w:rsidRDefault="0065609B">' +
            '<w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr></w:pPr>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">  {{fecha_certificado}}                                       {{nombre_supervisor}}                              {{dependencia}}</w:t></w:r>' +
            '</w:p>';
        xml = xml.replace(p5Old[0], p5New);
    }

    // 3. Replace paragraph 10 (nombre contratista)
    xml = xml.replace(
        /(<w:t xml:space="preserve">NOMBRE O RAZON SOCIAL DEL CONTRATISTA : <\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/,
        '$1{{nombre_contratista}}$2'
    );

    // 4. Replace paragraph 12 (identificacion)
    xml = xml.replace(
        /(<w:t xml:space="preserve">No\. DE IDENTIFICACIÓN DEL CONTRATISTA: <\/w:t>[\s\S]*?<w:t>)[^<]*(<\/w:t>)/,
        '$1{{identificacion_contratista}}$2'
    );

    // 5. Replace paragraph 14 (tipo_contrato y numero_contrato)
    xml = xml.replace(
        /(<w:t xml:space="preserve">CLASE O TIPO DE CONTRATO: <\/w:t>[\s\S]*?<w:t[^>]*>)[^<]*(<\/w:t>[\s\S]*?<w:t xml:space="preserve">NO\. DEL CONTRATO: <\/w:t>[\s\S]*?<w:t[^>]*>)[^<]*(<\/w:t>)/,
        '$1{{tipo_contrato}}$2{{numero_contrato}}$3'
    );

    // 6. Replace paragraph 16 (fecha acta inicio y fecha terminacion)
    const p16Old = xml.match(/<w:p\b[^>]*>[\s\S]*?FECHA DEL ACTA DE INICIO[\s\S]*?FECHA DE TERMINACION[\s\S]*?<\/w:p>/);
    if (p16Old) {
        const p16New = 
            '<w:p w14:paraId="29B69CF5" w14:textId="77777777" w:rsidR="0065609B" w:rsidRDefault="0065609B">' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">FECHA DEL ACTA DE INICIO : </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">{{fecha_acta_inicio}} </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">                            FECHA DE TERMINACION: </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:u w:val="single"/></w:rPr><w:t>{{fecha_terminacion}}</w:t></w:r>' +
            '</w:p>';
        xml = xml.replace(p16Old[0], p16New);
    }

    // 7. Replace paragraph 18 (cdp, rp, rubro)
    const p18Old = xml.match(/<w:p\b[^>]*>[\s\S]*?CDP:[\s\S]*?RP:[\s\S]*?Código \(Rubro Presupuestal\):[\s\S]*?<\/w:p>/);
    if (p18Old) {
        const p18New = 
            '<w:p w14:paraId="1E7C4CF0" w14:textId="77777777" w:rsidR="0065609B" w:rsidRDefault="0065609B">' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">CDP: </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:sz w:val="18"/><w:szCs w:val="18"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">{{cdp}} </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">      RP: </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:sz w:val="18"/><w:szCs w:val="18"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">{{rp}} </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">      Código (Rubro Presupuestal): </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>{{rubro_presupuestal}}</w:t></w:r>' +
            '</w:p>';
        xml = xml.replace(p18Old[0], p18New);
    }

    // 8. Replace paragraph 20 (valor total, entidad bancaria)
    const p20Old = xml.match(/<w:p\b[^>]*>[\s\S]*?VALOR TOTAL:[\s\S]*?ENTIDAD BANCARIA:[\s\S]*?<\/w:p>/);
    if (p20Old) {
        const p20New = 
            '<w:p w14:paraId="152F2A44" w14:textId="77777777" w:rsidR="0065609B" w:rsidRDefault="0065609B">' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">VALOR TOTAL: </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">{{valor_total}} </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">                            ENTIDAD BANCARIA: </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:sz w:val="18"/><w:szCs w:val="18"/><w:u w:val="single"/></w:rPr><w:t>{{entidad_bancaria}}</w:t></w:r>' +
            '</w:p>';
        xml = xml.replace(p20Old[0], p20New);
    }

    // 9. Replace paragraph 21 (valor autorizado, cuenta no)
    const p21Old = xml.match(/<w:p\b[^>]*>[\s\S]*?VALOR AUTORIZADO PARA EL PAGO:[\s\S]*?CUENTA No:[\s\S]*?<\/w:p>/);
    if (p21Old) {
        const p21New = 
            '<w:p w14:paraId="21BF6A77" w14:textId="77777777" w:rsidR="0065609B" w:rsidRDefault="0065609B">' +
            '<w:pPr><w:tabs><w:tab w:val="left" w:pos="5685"/><w:tab w:val="left" w:pos="5970"/></w:tabs></w:pPr>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">VALOR AUTORIZADO PARA EL PAGO: </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">{{valor_autorizado_pago}} </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">         CUENTA No: </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:sz w:val="18"/><w:szCs w:val="18"/><w:u w:val="single"/></w:rPr><w:t>{{numero_cuenta}}</w:t></w:r>' +
            '</w:p>';
        xml = xml.replace(p21Old[0], p21New);
    }

    // 10. Replace paragraph 23 (saldo restante, forma de pago)
    const p23Old = xml.match(/<w:p\b[^>]*>[\s\S]*?SALDO RESTANTE[\s\S]*?FORMA DE PAGO:[\s\S]*?<\/w:p>/);
    if (p23Old) {
        const p23New = 
            '<w:p w14:paraId="643230F7" w14:textId="77777777" w:rsidR="0065609B" w:rsidRDefault="0065609B">' +
            '<w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">SALDO RESTANTE : </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:sz w:val="18"/><w:szCs w:val="18"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">{{saldo_restante}} </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">                                          FORMA DE PAGO: </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t>{{forma_pago}}</w:t></w:r>' +
            '</w:p>';
        xml = xml.replace(p23Old[0], p23New);
    }

    // 11. Replace paragraph 25 (periodo pagar inicio y fin)
    const p25Old = xml.match(/<w:p\b[^>]*>[\s\S]*?PERIODO A PAGAR[\s\S]*?<\/w:p>/);
    if (p25Old) {
        const p25New = 
            '<w:p w14:paraId="7157CCFC" w14:textId="37B97F1D" w:rsidR="0065609B" w:rsidRDefault="0065609B">' +
            '<w:pPr><w:tabs><w:tab w:val="left" w:pos="5595"/><w:tab w:val="left" w:pos="5940"/></w:tabs><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr></w:pPr>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">PERIODO A PAGAR : </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">{{periodo_pagar_inicio}} al {{periodo_pagar_fin}}</w:t></w:r>' +
            '</w:p>';
        xml = xml.replace(p25Old[0], p25New);
    }

    // 12. Replace paragraph 26 (No. Planilla aportes)
    const p26Old = xml.match(/<w:p\b[^>]*>[\s\S]*?No\. Planilla de aportes de[\s\S]*?<\/w:p>/);
    if (p26Old) {
        const p26New = 
            '<w:p w14:paraId="0876A1BE" w14:textId="77777777" w:rsidR="0065609B" w:rsidRDefault="0065609B">' +
            '<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:szCs w:val="18"/></w:rPr></w:pPr>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t>No. Planilla de aportes de {{mes_planilla}}: {{numero_planilla}}</w:t></w:r>' +
            '</w:p>';
        xml = xml.replace(p26Old[0], p26New);
    }

    // 13. Replace paragraph 28 (Pago de Pension)
    const p28Old = xml.match(/<w:p\b[^>]*>[\s\S]*?Pago de Pensión:[\s\S]*?<\/w:p>/);
    if (p28Old) {
        const p28New = 
            '<w:p w14:paraId="39BD6DFD" w14:textId="77777777" w:rsidR="0065609B" w:rsidRDefault="0065609B">' +
            '<w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:szCs w:val="18"/></w:rPr></w:pPr>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t xml:space="preserve">Pago de Pensión: </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t>$ {{valor_pension}}</w:t></w:r>' +
            '</w:p>';
        xml = xml.replace(p28Old[0], p28New);
    }

    // 14. Replace paragraph 29 (Acta de Inicio folios)
    xml = xml.replace(
        'Acta de Inicio (solo la primera vez): 1 folio(s).',
        'Acta de Inicio (solo la primera vez): {{soporte_acta_inicio_folios}} folio(s).'
    );

    // 15. Replace paragraph 30 (Informe contratista folios)
    xml = xml.replace(
        /(<w:t xml:space="preserve">Informe del contratista: <\/w:t>[\s\S]*?<w:t>)2(<\/w:t>)/,
        '$1{{soporte_informe_contratista_folios}}$2'
    );

    // 16. Replace paragraph 31 (Informe supervisor folios)
    xml = xml.replace(
        /(<w:t>Informe del supervisor y\/o interventor:<\/w:t>[\s\S]*?<w:t>)1(<\/w:t>)/,
        '$1{{soporte_informe_supervisor_folios}}$2'
    );

    // 17. Replace paragraph 39 (Pago de Salud)
    const p39Old = xml.match(/<w:p\b[^>]*>[\s\S]*?Pago de Salud:[\s\S]*?<\/w:p>/);
    if (p39Old) {
        const p39New = 
            '<w:p w14:paraId="7FF9A4B7" w14:textId="77777777" w:rsidR="0065609B" w:rsidRDefault="0065609B">' +
            '<w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr></w:pPr>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t xml:space="preserve">Pago de Salud: </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t>$ {{valor_salud}}</w:t></w:r>' +
            '</w:p>';
        xml = xml.replace(p39Old[0], p39New);
    }

    // 18. Replace paragraph 41 (ARL)
    const p41Old = xml.match(/<w:p\b[^>]*>[\s\S]*?ARL:[\s\S]*?<\/w:p>/);
    if (p41Old) {
        const p41New = 
            '<w:p w14:paraId="7F6E9FDC" w14:textId="77777777" w:rsidR="0065609B" w:rsidRDefault="0065609B">' +
            '<w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr></w:pPr>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t xml:space="preserve">ARL: </w:t></w:r>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="es-CO" w:eastAsia="es-CO"/></w:rPr><w:t>$ {{valor_arl}}</w:t></w:r>' +
            '</w:p>';
        xml = xml.replace(p41Old[0], p41New);
    }

    // 19. Replace paragraph 44 (Por lo tanto autorizo...)
    xml = xml.replace(
        /(Por lo tanto autorizo el pago por valor de: \$ )3\.000\.000/,
        '$1{{valor_pago_certificado}}'
    );

    // 20. Replace paragraph 46 (Checkboxes anticipo - sexto)
    const p46Old = xml.match(/<w:p\b[^>]*>[\s\S]*?QUE CORRESPONDE A: ANTICIPO[\s\S]*?SEXTO[\s\S]*?<\/w:p>/);
    if (p46Old) {
        const p46New = 
            '<w:p w14:paraId="11D7743E" w14:textId="37F9890F" w:rsidR="0065609B" w:rsidRDefault="0065609B">' +
            '<w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">QUE CORRESPONDE A: ANTICIPO {{chk_anticipo}} PRIMERO {{chk_primero}} SEGUNDO {{chk_segundo}} TERCERO {{chk_tercero}} CUARTO {{chk_cuarto}} QUINTO {{chk_quinto}} SEXTO {{chk_sexto}}</w:t></w:r>' +
            '</w:p>';
        xml = xml.replace(p46Old[0], p46New);
    }

    // 21. Replace paragraph 47 (Checkboxes septimo - otros)
    const p47Old = xml.match(/<w:p\b[^>]*>[\s\S]*?SEPTIMO[\s\S]*?CUAL:[\s\S]*?<\/w:p>/);
    if (p47Old) {
        const p47New = 
            '<w:p w14:paraId="119329A5" w14:textId="34AAADB6" w:rsidR="0065609B" w:rsidRDefault="0065609B">' +
            '<w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>' +
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">SEPTIMO {{chk_septimo}} OCTAVO {{chk_octavo}} NOVENO {{chk_noveno}} OTROS {{chk_otros}} CUAL: {{otros_cual}}</w:t></w:r>' +
            '</w:p>';
        xml = xml.replace(p47Old[0], p47New);
    }

    // Also remove the image relationship from document.xml.rels if needed
    const relsPath = 'word/_rels/document.xml.rels';
    let relsXml = zip.file(relsPath).asText();
    relsXml = relsXml.replace(/<Relationship[^>]*Id="rId7"[^>]*\/>/, '');
    zip.file(relsPath, relsXml);

    zip.file('word/document.xml', xml);
    const newBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(tplPath, newBuf);
    console.log('✅ Created perfect calibrated template: FORMATO CERTIFICADO DEL SUPERVISOR.docx');
}

createPerfectSupervisorTemplate();

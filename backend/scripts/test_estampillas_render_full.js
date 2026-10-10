const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const templatePath = 'C:/Users/OSCAR_PC/Desktop/FORMATO DESCUENTO DE ESTAMPILLAS.docx';
const outputDocx = 'C:/Users/OSCAR_PC/Desktop/PRUEBA_DILIGENCIADO_ESTAMPILLAS.docx';

console.log('Reading template from:', templatePath);
const content = fs.readFileSync(templatePath, 'binary');
const zip = new PizZip(content);

const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' }
});

const sampleData = {
    ciudad_fecha_estampillas: 'Armenia Quindío, octubre de 2026',
    nombre_contratista: 'Oscar Alexander Henao Hernández',
    cedula_expedicion_larga: '9774679 de Armenia- Quindío',
    direccion_contratista: 'Carrera 18 # 2-75 Armenia - Quindío',
    telefono_contratista: '3113414361',
    especificar_contrato_estampillas: 'PRESTACIÓN DE SERVICIOS DE APOYO A LA GESTION   CO1.PCCNTR.9868346(TIC-CD-2026-092)',
    identificacion_contratista: '9774679',
    lugar_expedicion_cc: 'Armenia-Quindío',
    chk_estampilla_pro_desarrollo: '[ X ]',
    chk_estampilla_pro_hospital: '[ X ]',
    chk_estampilla_pro_cultura: '[ X ]',
    chk_estampilla_pro_bienestar: '[ X ]',
    chk_contrato_apoyo_gestion: '[ X ]',
    chk_contrato_prof_servicios: '[   ]',
    chk_contrato_obra: '[   ]',
    chk_contrato_consultoria: '[   ]',
    chk_contrato_compraventa: '[   ]',
    chk_contrato_proveedor: '[   ]',
    chk_contrato_otro: '[   ]'
};

doc.render(sampleData);

const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(outputDocx, buf);
console.log('Successfully generated test docx at:', outputDocx);

const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const content = fs.readFileSync('templates/FORMATO DESCUENTO DE ESTAMPILLAS.docx', 'binary');
const zip = new PizZip(content);
const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' }
});

doc.render({
    ciudad_fecha_estampillas: 'Armenia Quindío, septiembre de 2026',
    nombre_contratista: 'Oscar Alexander Henao Hernández',
    cedula_expedicion_larga: '9774679 de Armenia- Quindío',
    direccion_contratista: 'carrera 18#2-75 Armenia -Quindío',
    telefono_contratista: '3113414361',
    especificar_contrato_estampillas: 'PRESTACIÓN DE SERVICIOS DE APOYO A LA GESTION   CO1.PCCNTR.9868346(TIC-CD-2026-092)',
    identificacion_contratista: '9774679',
    lugar_expedicion_cc: 'Armenia-Quindío'
});

const buf = doc.getZip().generate({ type: 'nodebuffer' });
fs.writeFileSync('C:/Users/OSCAR_PC/.gemini/antigravity/brain/efcd9f10-0bfc-4d03-8795-d6dca58b5c3a/scratch/test_rendered_estampillas.docx', buf);
console.log('SUCCESS! Rendered calibrated estampillas docx successfully!');

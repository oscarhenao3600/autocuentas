const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const ImageModule = require("docxtemplater-image-module-free");
const fs = require("fs");
const path = require("path");

/**
 * Calculates moderate dimensions for images while strictly preserving aspect ratio
 * Max width: 340px (approx. 9.0 cm)
 * Max height: 220px (approx. 5.8 cm)
 */
function getModerateImageSize(buffer) {
    let width = 340;
    let height = 220;

    try {
        // PNG Header
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            width = buffer.readUInt32BE(16);
            height = buffer.readUInt32BE(20);
        } else if (buffer[0] === 0xFF && buffer[1] === 0xD8) { // JPEG Header
            let offset = 2;
            while (offset < buffer.length) {
                if (buffer[offset] !== 0xFF) break;
                const marker = buffer[offset + 1];
                if (marker === 0xC0 || marker === 0xC2) {
                    height = buffer.readUInt16BE(offset + 5);
                    width = buffer.readUInt16BE(offset + 7);
                    break;
                }
                const len = buffer.readUInt16BE(offset + 2);
                offset += 2 + len;
            }
        }
    } catch (_) {}

    const maxWidth = 340;
    const maxHeight = 220;
    const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
    return [Math.max(80, Math.round(width * ratio)), Math.max(60, Math.round(height * ratio))];
}

exports.generateDocument = async (templateName, data) => {
    try {
        const templatePath = path.resolve(__dirname, "..", "templates", templateName);
        const content = fs.readFileSync(templatePath, "binary");
        const zip = new PizZip(content);
        const docXml = zip.file("word/document.xml");
        let xmlText = docXml ? docXml.asText() : "";
        const hasDoubleBraces = /\{\{[^{}]+\}\}/.test(xmlText);

        // If template is Informe de Actividades, embed obligations, comments and evidence images directly into the Actividades Desarrolladas cell
        if (templateName.toUpperCase().includes('INFORME DE ACTIVIDADES')) {
            if (xmlText.includes('actividades_desarrolladas')) {
                const openLoop = hasDoubleBraces ? '{{#' : '{#';
                const closeLoop = hasDoubleBraces ? '{{/' : '{/';
                const openTag = hasDoubleBraces ? '{{' : '{';
                const closeTag = hasDoubleBraces ? '}}' : '}';

                const tagIdx = xmlText.indexOf('actividades_desarrolladas');
                const pStartBefore = xmlText.lastIndexOf('<w:p ', tagIdx);
                const pStartBasic = xmlText.lastIndexOf('<w:p>', tagIdx);
                const cellPStart = Math.max(pStartBefore, pStartBasic);
                const cellPEnd = xmlText.indexOf('</w:p>', tagIdx) + '</w:p>'.length;

                if (cellPStart !== -1 && cellPEnd > cellPStart) {
                    const oldP = xmlText.substring(cellPStart, cellPEnd);
                    const activitiesCellXml = 
                        '<w:p><w:r><w:t>' + openLoop + 'lista_actividades' + closeTag + '</w:t></w:r></w:p>' +
                        // Encabezado de la obligación en negrita (ej: 2.2.5. Apoyar a la Secretaría de TIC...)
                        '<w:p><w:pPr><w:spacing w:before="120" w:after="40"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>' + openTag + 'encabezado_obligacion' + closeTag + '</w:t></w:r></w:p>' +
                        // Texto de la actividad desarrollada justo sobre la imagen (ej: 5 Se dio apoyo... carpeta2.2.5 Anexo 5.1.)
                        '<w:p><w:pPr><w:spacing w:before="40" w:after="80"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t>' + openTag + 'texto_actividad' + closeTag + '</w:t></w:r></w:p>' +
                        // Fotos ubicadas inmediatamente debajo del texto
                        '<w:p><w:r><w:t>' + openLoop + 'fotos' + closeTag + '</w:t></w:r></w:p>' +
                        '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="100"/></w:pPr><w:r><w:t>' + openTag + '%foto' + closeTag + '</w:t></w:r></w:p>' +
                        '<w:p><w:r><w:t>' + closeLoop + 'fotos' + closeTag + '</w:t></w:r></w:p>' +
                        // Separador sutil entre obligaciones
                        '<w:p><w:pPr><w:spacing w:before="80" w:after="120"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="8" w:color="D0D0D0"/></w:pBdr></w:pPr></w:p>' +
                        '<w:p><w:r><w:t>' + closeLoop + 'lista_actividades' + closeTag + '</w:t></w:r></w:p>';
                    xmlText = xmlText.replace(oldP, activitiesCellXml);
                    zip.file("word/document.xml", xmlText);
                }
            }
        }

        // Map to store Buffers so that docxtemplater receives string keys (avoiding TypeError on Buffer objects)
        const imageBufferMap = new Map();
        let imgKeyCounter = 0;

        function sanitizeImages(obj) {
            if (!obj || typeof obj !== 'object') return obj;
            if (Buffer.isBuffer(obj)) {
                imgKeyCounter++;
                const imgKey = `__img_buf_${imgKeyCounter}`;
                imageBufferMap.set(imgKey, obj);
                return imgKey;
            }
            if (Array.isArray(obj)) {
                return obj.map(sanitizeImages);
            }
            const copy = { ...obj };
            for (const key of Object.keys(copy)) {
                const val = copy[key];
                if (Buffer.isBuffer(val)) {
                    imgKeyCounter++;
                    const imgKey = `__img_buf_${imgKeyCounter}`;
                    imageBufferMap.set(imgKey, val);
                    copy[key] = imgKey;
                } else if (typeof val === 'object' && val !== null) {
                    copy[key] = sanitizeImages(val);
                }
            }
            return copy;
        }

        const sanitizedData = sanitizeImages(data);

        // Configure ImageModule for Docxtemplater
        const imageOpts = {
            centered: true,
            fileType: "docx",
            getImage: function(tagValue) {
                if (typeof tagValue === 'string' && imageBufferMap.has(tagValue)) {
                    return imageBufferMap.get(tagValue);
                }
                if (Buffer.isBuffer(tagValue)) {
                    return tagValue;
                }
                if (typeof tagValue === 'string' && fs.existsSync(tagValue)) {
                    try {
                        return fs.readFileSync(tagValue);
                    } catch (_) {}
                }
                return null;
            },
            getSize: function(img, tagValue) {
                try {
                    const buf = img || (typeof tagValue === 'string' && imageBufferMap.has(tagValue) 
                        ? imageBufferMap.get(tagValue) 
                        : (Buffer.isBuffer(tagValue) 
                            ? tagValue 
                            : (typeof tagValue === 'string' && fs.existsSync(tagValue) ? fs.readFileSync(tagValue) : null)));
                    if (buf) return getModerateImageSize(buf);
                    return [300, 200];
                } catch (_) {
                    return [300, 200];
                }
            }
        };

        const imageModule = new ImageModule(imageOpts);

        const doc = new Docxtemplater(zip, {
            modules: [imageModule],
            paragraphLoop: true,
            linebreaks: true,
            delimiters: hasDoubleBraces ? { start: "{{", end: "}}" } : { start: "{", end: "}" },
        });

        // Fill the template with data
        doc.render(sanitizedData);

        const buf = doc.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE",
        });

        const outputDir = path.resolve(__dirname, "..", "generated");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const fileName = `${Date.now()}-${templateName}`;
        const outputPath = path.join(outputDir, fileName);
        fs.writeFileSync(outputPath, buf);

        return {
            fileName,
            outputPath
        };
    } catch (error) {
        console.error("Error al generar documento:", error);
        throw new Error("No se pudo generar el documento basado en la plantilla: " + error.message);
    }
};

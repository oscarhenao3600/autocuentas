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

        // If template is Informe de Actividades, inject the photo annex loop if not present
        if (templateName.toUpperCase().includes('INFORME DE ACTIVIDADES') && !xmlText.includes('fotos_evidencias')) {
            const target = '</w:tbl>';
            if (xmlText.includes(target)) {
                const openLoop = hasDoubleBraces ? '{{#' : '{#';
                const closeLoop = hasDoubleBraces ? '{{/' : '{/';
                const openTag = hasDoubleBraces ? '{{' : '{';
                const closeTag = hasDoubleBraces ? '}}' : '}';

                const photoAnnexXml = '</w:tbl>' +
                    '<w:p><w:pPr><w:spacing w:before="360" w:after="120"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="002060"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="002060"/></w:rPr><w:t>' + openLoop + 'tiene_fotos_evidencias' + closeTag + 'REGISTRO FOTOGRÁFICO DE ACTIVIDADES' + closeLoop + 'tiene_fotos_evidencias' + closeTag + '</w:t></w:r></w:p>' +
                    '<w:p><w:r><w:t>' + openLoop + 'fotos_evidencias' + closeTag + '</w:t></w:r></w:p>' +
                    '<w:p><w:pPr><w:spacing w:before="140" w:after="40"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>Obligación ' + openTag + 'codigo' + closeTag + ':</w:t></w:r></w:p>' +
                    '<w:p><w:pPr><w:spacing w:before="40" w:after="80"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="333333"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="333333"/></w:rPr><w:t>' + openTag + 'descripcion' + closeTag + '</w:t></w:r></w:p>' +
                    '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="200"/></w:pPr><w:r><w:t>' + openTag + '%foto' + closeTag + '</w:t></w:r></w:p>' +
                    '<w:p><w:r><w:t>' + closeLoop + 'fotos_evidencias' + closeTag + '</w:t></w:r></w:p>';
                xmlText = xmlText.replace(target, photoAnnexXml);
                zip.file("word/document.xml", xmlText);
            }
        }

        // Configure ImageModule for Docxtemplater
        const imageOpts = {
            centered: true,
            fileType: "docx",
            getImage: function(tagValue) {
                return fs.readFileSync(tagValue);
            },
            getSize: function(img, tagValue) {
                try {
                    const buf = fs.readFileSync(tagValue);
                    return getModerateImageSize(buf);
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
        doc.render(data);

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

const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const fs = require("fs");
const path = require("path");

exports.generateDocument = async (templateName, data) => {
    try {
        const templatePath = path.resolve(__dirname, "..", "templates", templateName);
        const content = fs.readFileSync(templatePath, "binary");
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        // Fill the template with data
        doc.render(data);

        const buf = doc.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE",
        });

        const outputDir = path.resolve(__dirname, "..", "generated");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
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
        throw new Error("No se pudo generar el documento basado en la plantilla");
    }
};

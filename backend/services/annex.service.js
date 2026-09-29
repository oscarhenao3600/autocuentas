const {
    Document,
    Packer,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    AlignmentType,
    TextRun,
    ImageRun
} = require("docx");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { PDFParse } = require("pdf-parse");
const storageService = require("./storage.service");

/**
 * Calculates moderate dimensions for evidence images in the annex so that
 * approximately 3 images fit comfortably per printed page.
 * Column 1 width is ~9.5 cm (approx 360 px at 96 DPI, 270 pt).
 * 
 * Landscape limit: 320 x 155 px (approx 240 x 116 pt, 8.5 x 4.1 cm)
 * Portrait limit:  180 x 210 px (approx 135 x 158 pt, 4.8 x 5.6 cm)
 */
function getAnnexImageSize(rawWidth, rawHeight) {
    let width = rawWidth || 600;
    let height = rawHeight || 400;

    const isPortrait = height > width;
    const maxWidth = isPortrait ? 200 : 320;
    const maxHeight = isPortrait ? 220 : 155;

    const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
    const targetW = Math.max(90, Math.round(width * ratio));
    const targetH = Math.max(70, Math.round(height * ratio));

    return { width: targetW, height: targetH };
}

/**
 * Parses image header dimensions for PNG or JPEG buffers
 */
function parseImageDimensions(buffer) {
    let width = 640;
    let height = 480;
    let type = "jpg";

    try {
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            type = "png";
            width = buffer.readUInt32BE(16);
            height = buffer.readUInt32BE(20);
        } else if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            type = "jpg";
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

    return { width, height, type };
}

/**
 * Renders the first page of a document or spreadsheet into a PNG preview image
 * using the python rendering helper.
 */
async function renderWithPythonHelper(inputPathOrBuffer, filename) {
    const ext = path.extname(filename || "").toLowerCase() || ".pdf";
    let tempInput = null;
    let isTemp = false;

    if (Buffer.isBuffer(inputPathOrBuffer)) {
        tempInput = path.join(os.tmpdir(), `temp_annex_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
        fs.writeFileSync(tempInput, inputPathOrBuffer);
        isTemp = true;
    } else if (typeof inputPathOrBuffer === "string" && fs.existsSync(inputPathOrBuffer)) {
        tempInput = inputPathOrBuffer;
    } else {
        throw new Error(`Ruta de archivo o buffer inválido para renderizado: ${inputPathOrBuffer}`);
    }

    const tempOutput = path.join(os.tmpdir(), `temp_annex_out_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
    const scriptPath = path.resolve(__dirname, "..", "scripts", "render_preview.py");

    return new Promise((resolve, reject) => {
        execFile("python", [scriptPath, "--input", tempInput, "--output", tempOutput], (err, stdout, stderr) => {
            if (isTemp && tempInput && fs.existsSync(tempInput)) {
                try { fs.unlinkSync(tempInput); } catch (_) {}
            }

            if (err) {
                console.warn(`[Annex Service] Error en render_preview.py: ${err.message}`, stderr);
                return reject(err);
            }

            if (fs.existsSync(tempOutput)) {
                try {
                    const buf = fs.readFileSync(tempOutput);
                    fs.unlinkSync(tempOutput);
                    const dims = parseImageDimensions(buf);
                    const scaled = getAnnexImageSize(dims.width, dims.height);
                    return resolve({
                        buffer: buf,
                        type: "png",
                        width: scaled.width,
                        height: scaled.height
                    });
                } catch (readErr) {
                    return reject(readErr);
                }
            } else {
                return reject(new Error("No se generó la imagen de vista previa del documento"));
            }
        });
    });
}

/**
 * Extracts or generates an image preview for a given evidence item.
 * Supports raw photos (PNG, JPG, WEBP), PDFs, Excel (.xlsx, .xls), and Word (.docx, .doc).
 * 
 * @param {Object} ev - Evidence item ({ path, driveId, filename, mimetype, buffer })
 * @returns {Promise<{ buffer: Buffer, type: 'png'|'jpg', width: number, height: number }|null>}
 */
async function renderEvidenceToImage(ev) {
    if (!ev) return null;

    let buf = ev.buffer || null;
    const targetPath = ev.path || ev.driveId;
    const filename = ev.filename || (typeof targetPath === "string" ? path.basename(targetPath) : "evidencia.png");
    const mime = (ev.mimetype || "").toLowerCase();
    const ext = path.extname(filename).toLowerCase();

    if (!buf && targetPath) {
        try {
            buf = await storageService.getFileBuffer(targetPath);
        } catch (fetchErr) {
            console.warn(`[Annex Service] No se pudo obtener buffer para soporte ${filename}:`, fetchErr.message);
        }
    }

    if (!buf) return null;

    const isImage = mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".bmp", ".webp"].includes(ext);
    const isPdf = mime === "application/pdf" || ext === ".pdf";
    const isExcel = [".xlsx", ".xls"].includes(ext) || mime.includes("spreadsheet") || mime.includes("excel");
    const isWord = [".docx", ".doc"].includes(ext) || mime.includes("word");

    // Case 1: Direct photo evidence
    if (isImage) {
        const { width: rawW, height: rawH, type: rawType } = parseImageDimensions(buf);
        const scaled = getAnnexImageSize(rawW, rawH);
        return {
            buffer: buf,
            type: rawType === "png" ? "png" : "jpg",
            width: scaled.width,
            height: scaled.height
        };
    }

    // Case 2: PDF Document evidence (renders page 1 screenshot)
    if (isPdf) {
        try {
            const parser = new PDFParse({ data: buf });
            await parser.load();
            const screenRes = await parser.getScreenshot({ imageBuffer: true });
            if (screenRes && screenRes.pages && screenRes.pages.length > 0) {
                const pageBuf = Buffer.from(screenRes.pages[0].data);
                const rawW = screenRes.pages[0].width || 612;
                const rawH = screenRes.pages[0].height || 792;
                const scaled = getAnnexImageSize(rawW, rawH);
                return {
                    buffer: pageBuf,
                    type: "png",
                    width: scaled.width,
                    height: scaled.height
                };
            }
        } catch (pdfErr) {
            console.warn(`[Annex Service] Intento con pdf-parse falló (${pdfErr.message}), intentando con python...`);
        }

        try {
            return await renderWithPythonHelper(buf, filename);
        } catch (pyErr) {
            console.warn(`[Annex Service] Error en preview PDF con Python:`, pyErr.message);
            return null;
        }
    }

    // Case 3: Excel Document evidence (renders page 1 spreadsheet snapshot)
    if (isExcel) {
        try {
            return await renderWithPythonHelper(buf, filename);
        } catch (xlErr) {
            console.warn(`[Annex Service] Error en preview Excel:`, xlErr.message);
            return null;
        }
    }

    // Case 4: Word Document evidence
    if (isWord) {
        try {
            return await renderWithPythonHelper(buf, filename);
        } catch (wErr) {
            console.warn(`[Annex Service] Error en preview Word:`, wErr.message);
            return null;
        }
    }

    return null;
}

/**
 * Cleans obligation code and text to avoid redundant repetition
 */
function cleanObligationHeading(code, text) {
    const cleanCode = (code || "").trim();
    let cleanText = (text || "").trim();

    // If text already begins with "Obligación 2.2.X" or "2.2.X"
    if (/^obligaci[oó]n\s*[\d.]+/i.test(cleanText)) {
        return cleanText;
    }
    if (/^[\d.]+\.?\s+/i.test(cleanText)) {
        cleanText = cleanText.replace(/^[\d.]+\.?\s+/, "");
    }

    if (cleanCode) {
        return `Obligación ${cleanCode}. ${cleanText}`;
    }
    return cleanText;
}

/**
 * Standard filename for the obligation annex:
 * "Anexo Descripcion #[codigo].docx" (e.g. "Anexo Descripcion 2.2.2.docx")
 */
function getAnnexFileName(obligationCode) {
    const safeCode = (obligationCode || "General").trim().replace(/[^a-zA-Z0-9.-]/g, "_");
    return `Anexo Descripcion ${safeCode}.docx`;
}

/**
 * Generates the official Word document "Anexo Descripcion #[codigo].docx"
 * matching the layout, borders, font styles, and pagination of the reference model.
 * 
 * Layout:
 * - Margins: 2.0 cm on all sides (Letter size)
 * - Table width: 9915 dxa (approx 17.5 cm)
 * - Row 0: Merged cell spanning both columns with the full obligation heading.
 * - Row 1:
 *   - Col 0 (Width 5381 dxa / 9.49 cm): Header "FOTO(S)" + images stacked vertically (3 per page).
 *   - Col 1 (Width 4534 dxa / 7.99 cm): Header "DESCRIPCIÓN" + 100-150 word technical text.
 * 
 * @param {Object} options
 * @param {string} options.obligationCode - e.g. "2.2.2"
 * @param {string} options.obligationText - The obligation title/description
 * @param {Array}  options.images - Array of { buffer: Buffer, type: 'png'|'jpg', width: number, height: number }
 * @param {string} options.description - The 100-150 word extensive technical description
 * @returns {Promise<Buffer>} - Buffer of the generated .docx file
 */
async function generateAnnexDocument({
    obligationCode = "",
    obligationText = "",
    images = [],
    description = ""
}) {
    const singleBorder = {
        style: BorderStyle.SINGLE,
        size: 4,
        color: "000000"
    };

    const cellBorders = {
        top: singleBorder,
        bottom: singleBorder,
        left: singleBorder,
        right: singleBorder
    };

    // 1. Build Left Column (FOTO(S) + images)
    const leftCellParagraphs = [];
    leftCellParagraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 120 },
        children: [
            new TextRun({
                text: "FOTO(S)",
                bold: true,
                font: "Arial",
                size: 20 // 10 pt
            })
        ]
    }));

    if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            if (img && img.buffer) {
                leftCellParagraphs.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 40, after: 110 },
                    children: [
                        new ImageRun({
                            data: img.buffer,
                            transformation: {
                                width: img.width || 320,
                                height: img.height || 155
                            },
                            type: img.type === "png" ? "png" : "jpg"
                        })
                    ]
                }));
            }
        }
    } else {
        leftCellParagraphs.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 100 },
            children: [
                new TextRun({
                    text: "(Sin registros fotográficos reportados)",
                    italics: true,
                    font: "Arial",
                    size: 18,
                    color: "666666"
                })
            ]
        }));
    }

    // 2. Build Right Column (DESCRIPCIÓN + extensive text)
    const rightCellParagraphs = [];
    rightCellParagraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 160 },
        children: [
            new TextRun({
                text: "DESCRIPCIÓN",
                bold: true,
                font: "Arial",
                size: 20 // 10 pt
            })
        ]
    }));

    const cleanDesc = (description || "Actividades ejecutadas conforme a lo requerido para el periodo.").trim();
    const descParagraphs = cleanDesc.split(/\n\s*\n|\r\n\s*\r\n/).filter(p => p.trim().length > 0);

    for (const paragraphText of descParagraphs) {
        rightCellParagraphs.push(new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 60, after: 120, line: 276 }, // line: 276 = 1.15 line spacing
            children: [
                new TextRun({
                    text: paragraphText.trim(),
                    font: "Arial",
                    size: 19 // 9.5 pt
                })
            ]
        }));
    }

    // 3. Build Top Obligation Heading
    const fullHeading = cleanObligationHeading(obligationCode, obligationText);

    // 4. Construct Table
    const table = new Table({
        width: { size: 9915, type: WidthType.DXA },
        columnWidths: [5381, 4534],
        rows: [
            // Row 0: Top Obligation Header spanning both columns
            new TableRow({
                tableHeader: true,
                children: [
                    new TableCell({
                        columnSpan: 2,
                        width: { size: 9915, type: WidthType.DXA },
                        borders: cellBorders,
                        margins: { top: 120, bottom: 120, left: 140, right: 140 },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.JUSTIFIED,
                                spacing: { before: 40, after: 40 },
                                children: [
                                    new TextRun({
                                        text: fullHeading,
                                        font: "Arial",
                                        size: 20 // 10 pt
                                    })
                                ]
                            })
                        ]
                    })
                ]
            }),
            // Row 1: Content Row (FOTO(S) | DESCRIPCIÓN)
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 5381, type: WidthType.DXA },
                        borders: cellBorders,
                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                        children: leftCellParagraphs
                    }),
                    new TableCell({
                        width: { size: 4534, type: WidthType.DXA },
                        borders: cellBorders,
                        margins: { top: 100, bottom: 100, left: 140, right: 140 },
                        children: rightCellParagraphs
                    })
                ]
            })
        ]
    });

    // 5. Construct Document with standard letter size and 2.0 cm margins
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: 1134,    // 2.0 cm
                        bottom: 1134, // 2.0 cm
                        left: 1134,   // 2.0 cm
                        right: 1134   // 2.0 cm
                    },
                    size: {
                        width: 12240, // Letter width
                        height: 15840 // Letter height
                    }
                }
            },
            children: [table]
        }]
    });

    return await Packer.toBuffer(doc);
}

module.exports = {
    getAnnexImageSize,
    renderEvidenceToImage,
    cleanObligationHeading,
    getAnnexFileName,
    generateAnnexDocument
};

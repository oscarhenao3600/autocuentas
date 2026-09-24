const { PDFParse, PasswordException } = require("pdf-parse");
const { PDFDocument } = require("pdf-lib");
const fs = require("fs");

/**
 * Checks if a PDF buffer or file path is encrypted/password-protected.
 * @param {string|Buffer} filePathOrBuffer
 * @returns {Promise<boolean>}
 */
async function isPdfEncrypted(filePathOrBuffer) {
    try {
        const data = Buffer.isBuffer(filePathOrBuffer) ? filePathOrBuffer : fs.readFileSync(filePathOrBuffer);
        const parser = new PDFParse({ data });
        await parser.load();
        return false;
    } catch (err) {
        if (err.name === 'PasswordException' || (err.message && err.message.toLowerCase().includes('password'))) {
            return true;
        }
        // If it failed for another reason (e.g. invalid PDF), rethrow
        throw err;
    }
}

/**
 * Helper to extract plain text from any standard unencrypted or known-password PDF.
 * @param {string|Buffer} filePathOrBuffer
 * @param {string} [password]
 * @returns {Promise<string>}
 */
async function parsePdfText(filePathOrBuffer, password = null) {
    const data = Buffer.isBuffer(filePathOrBuffer) ? filePathOrBuffer : fs.readFileSync(filePathOrBuffer);
    const opts = { data };
    if (password) {
        opts.password = String(password);
    }
    const parser = new PDFParse(opts);
    const res = await parser.getText();
    return res.text || "";
}

/**
 * Renders pages of an unlocked PDF and re-saves it as an unencrypted clean PDF.
 * This guarantees that supervisors, treasury, and zip exporters can open the document
 * without needing the contractor's credentials.
 * @param {PDFParse} parser - An already loaded/unlocked PDFParse instance
 * @param {string} targetSavePath - File path to overwrite with clean PDF
 * @returns {Promise<boolean>}
 */
async function unlockAndSaveCleanPdf(parser, targetSavePath) {
    try {
        const screenRes = await parser.getScreenshot({ imageBuffer: true });
        if (screenRes && screenRes.pages && screenRes.pages.length > 0) {
            const pdfDoc = await PDFDocument.create();
            for (const page of screenRes.pages) {
                const img = await pdfDoc.embedPng(page.data);
                const pdfPage = pdfDoc.addPage([page.width, page.height]);
                pdfPage.drawImage(img, { x: 0, y: 0, width: page.width, height: page.height });
            }
            const cleanBytes = await pdfDoc.save();
            fs.writeFileSync(targetSavePath, Buffer.from(cleanBytes));
            console.log(`[PDF Utils] Documento desencriptado y guardado sin clave en: ${targetSavePath}`);
            return true;
        }
    } catch (err) {
        console.warn("[PDF Utils] No se pudo re-guardar copia limpia del PDF (se mantiene el archivo previo):", err.message);
    }
    return false;
}

/**
 * Attempts to unlock an encrypted PDF using a list of candidate passwords.
 * If encrypted and none match, throws an Error with code 'PASSWORD_REQUIRED'.
 * 
 * @param {string|Buffer} filePathOrBuffer
 * @param {Object} options
 * @param {string} [options.password] - An explicit password provided by the user
 * @param {string[]} [options.candidatePasswords] - Other candidate passwords (e.g. cédula variants)
 * @param {string} [options.targetSavePath] - Path to overwrite with clean unencrypted PDF upon success
 * @returns {Promise<{ text: string, isEncrypted: boolean, unlocked: boolean, usedPassword: string|null, parser: PDFParse }>}
 */
async function unlockPdfWithCandidates(filePathOrBuffer, options = {}) {
    const data = Buffer.isBuffer(filePathOrBuffer) ? filePathOrBuffer : fs.readFileSync(filePathOrBuffer);
    const targetSavePath = options.targetSavePath || (typeof filePathOrBuffer === 'string' ? filePathOrBuffer : null);

    // 1. First, check if the PDF is even encrypted
    let isEncrypted = false;
    let initialParser = new PDFParse({ data });
    try {
        await initialParser.load();
        const text = (await initialParser.getText()).text || "";
        return {
            text,
            isEncrypted: false,
            unlocked: false,
            usedPassword: null,
            parser: initialParser
        };
    } catch (err) {
        if (err.name === 'PasswordException' || (err.message && err.message.toLowerCase().includes('password'))) {
            isEncrypted = true;
        } else {
            throw err;
        }
    }

    // 2. Prepare candidate passwords
    const rawCandidates = [];
    if (options.password && typeof options.password === 'string' && options.password.trim()) {
        rawCandidates.push(options.password.trim());
    }

    if (Array.isArray(options.candidatePasswords)) {
        for (const cand of options.candidatePasswords) {
            if (cand && typeof cand === 'string' && cand.trim()) {
                const trimmed = cand.trim();
                rawCandidates.push(trimmed);
                // Also add numeric digits only if different (e.g. "1.094.901.234" -> "1094901234")
                const digitsOnly = trimmed.replace(/\D/g, '');
                if (digitsOnly && digitsOnly !== trimmed) {
                    rawCandidates.push(digitsOnly);
                }
            }
        }
    }

    // Deduplicate candidates while preserving order
    const candidates = [...new Set(rawCandidates)];

    // 3. Try each candidate password
    for (const candidate of candidates) {
        try {
            const parser = new PDFParse({ data, password: candidate });
            await parser.load();
            const textResult = await parser.getText();
            const text = textResult.text || "";

            // If a target save path is provided, convert to a clean unencrypted PDF
            if (targetSavePath) {
                await unlockAndSaveCleanPdf(parser, targetSavePath);
            }

            console.log(`[PDF Utils] PDF desbloqueado con éxito usando contraseña candidata.`);
            return {
                text,
                isEncrypted: true,
                unlocked: true,
                usedPassword: candidate,
                parser
            };
        } catch (passErr) {
            // Password did not work, continue to next candidate
            continue;
        }
    }

    // 4. None of the candidates worked or no candidates provided
    const passError = new Error("El documento está protegido con contraseña.");
    passError.code = "PASSWORD_REQUIRED";
    passError.isEncrypted = true;
    passError.testedCount = candidates.length;
    throw passError;
}

module.exports = {
    isPdfEncrypted,
    parsePdfText,
    unlockAndSaveCleanPdf,
    unlockPdfWithCandidates
};

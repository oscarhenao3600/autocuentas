/**
 * Utility functions for Colombian Cédula analysis and Senior (60+) Friendly UX Mode.
 * Based on historical assignment rules from the Registraduría Nacional del Estado Civil.
 */

/**
 * Strips non-digit characters from an identification document.
 * @param {string|number} cedula 
 * @returns {string} Digits only
 */
function cleanCedula(cedula) {
    if (!cedula) return '';
    return String(cedula).replace(/\D/g, '');
}

/**
 * Evaluates whether a Colombian citizen ID corresponds to a person aged 60 or older.
 * 
 * Historical assignment context in Colombia:
 * 1. 10 digits (>= 1.000.000.000): NUIP unified system launched in Sept 2000.
 *    Assigned to people turning 18 from 2000 onwards (born >= 1982).
 *    All 10-digit holders are younger than 45 years old (definitely NOT senior).
 * 
 * 2. 1 to 7 digits (< 10.000.000):
 *    Assigned prior to ~1972. Persons born before 1954 (Age >= 72 years in 2026).
 *    100% senior (60+).
 * 
 * 3. 8 digits (< 100.000.000):
 *    - Men series (< 20.000.000): Issued in Bogotá and major departments before 1984.
 *      Born before 1966 -> Age >= 60 years in 2026.
 *    - Women series (20.000.000 to 43.000.000): Female identification series started in 1956.
 *      Numbers up to 43M were assigned before 1985 -> Born before 1966 -> Age >= 60 in 2026.
 *    - Numbers between 43.000.000 and 99.999.999: Issued between 1985 and 2000 (ages 44-59).
 * 
 * @param {string|number} cedula 
 * @returns {boolean} True if estimated age >= 60 years
 */
function isSeniorByCedula(cedula) {
    const clean = cleanCedula(cedula);
    if (!clean || clean.length < 5) return false;

    // 10 digits or more -> Unified NUIP (Under 45 years old)
    if (clean.length >= 10) {
        return false;
    }

    const num = parseInt(clean, 10);
    if (isNaN(num)) return false;

    // 1 to 7 digits (< 10M) -> Age >= 72
    if (num < 10000000) {
        return true;
    }

    // 8 digits men series (< 20M) -> Age >= 60
    if (num < 20000000) {
        return true;
    }

    // 8 digits women series (20M - 43M) -> Age >= 60
    if (num >= 20000000 && num <= 43000000) {
        return true;
    }

    return false;
}

/**
 * Detailed analysis of age estimation and UX recommendations
 * @param {string|number} cedula 
 */
function getSeniorStatus(cedula) {
    const clean = cleanCedula(cedula);
    if (!clean) {
        return { isSenior: false, reason: 'Sin cédula para evaluar', confidence: 'none' };
    }

    if (clean.length >= 10) {
        return {
            isSenior: false,
            estimatedAgeGroup: 'Menor de 45 años (Cédula de 10 dígitos / NUIP desde el año 2000)',
            confidence: 'high',
            cleanCedula: clean
        };
    }

    const num = parseInt(clean, 10);
    if (num < 10000000) {
        return {
            isSenior: true,
            estimatedAgeGroup: 'Mayor de 70 años (Cédula de 1 a 7 dígitos expedida antes de 1972)',
            confidence: 'high',
            cleanCedula: clean
        };
    }

    if (num < 20000000) {
        return {
            isSenior: true,
            estimatedAgeGroup: 'Mayor de 60 años (Cédula tradicional expedida antes de 1984)',
            confidence: 'high',
            cleanCedula: clean
        };
    }

    if (num >= 20000000 && num <= 43000000) {
        return {
            isSenior: true,
            estimatedAgeGroup: 'Mayor de 60 años (Cédula serie femenina expedida antes de 1985)',
            confidence: 'high',
            cleanCedula: clean
        };
    }

    return {
        isSenior: false,
        estimatedAgeGroup: 'Adulto (45 - 59 años)',
        confidence: 'medium',
        cleanCedula: clean
    };
}

/**
 * Resolves whether senior mode should be active for a user/contract.
 * Priority: Explicit user preference in DB > Automatic deduction by Cédula
 * @param {object} user 
 * @param {object} [contract] 
 * @returns {'senior'|'standard'}
 */
function getEffectiveUiMode(user, contract = null) {
    if (user && user.uiMode === 'senior') return 'senior';
    if (user && user.uiMode === 'standard') return 'standard';

    const testCedula = contract?.idNumber || user?.cedula || user?.idNumber;
    if (testCedula && isSeniorByCedula(testCedula)) {
        return 'senior';
    }

    return 'standard';
}

/**
 * Formats Telegram inline keyboard layout for optimal senior accessibility.
 * In 'senior' mode:
 * - Expands multiple buttons in a single row into 1 button per row (full-width)
 *   so buttons are much easier to see and tap without precision aiming.
 * @param {Array<Array<object>>} keyboard 
 * @param {'senior'|'standard'} uiMode 
 * @returns {Array<Array<object>>}
 */
function formatKeyboardForMode(keyboard, uiMode = 'standard') {
    if (!Array.isArray(keyboard) || keyboard.length === 0) return keyboard;
    if (uiMode !== 'senior') return keyboard;

    const flattened = [];
    for (const row of keyboard) {
        if (Array.isArray(row)) {
            for (const btn of row) {
                if (btn && btn.text) {
                    flattened.push([btn]);
                }
            }
        }
    }
    return flattened;
}

/**
 * Instructions text on how to attach photos or documents in Telegram
 */
function getTelegramAttachmentGuide() {
    return `💡 *¿Cómo adjuntar tu documento o foto?*\n` +
           `1️⃣ Busca el icono del clip 📎 o de la cámara 📷 que está abajo a la derecha (donde escribes el mensaje).\n` +
           `2️⃣ Toca sobre él y selecciona la foto o el archivo PDF de tu pago.\n` +
           `3️⃣ Presiona la flecha azul de enviar ↗️.\n\n` +
           `*(Si no encuentras el archivo, no te preocupes, puedes tocar el botón "Cancelar" para salir).*`;
}

module.exports = {
    cleanCedula,
    isSeniorByCedula,
    getSeniorStatus,
    getEffectiveUiMode,
    formatKeyboardForMode,
    getTelegramAttachmentGuide
};

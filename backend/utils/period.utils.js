/**
 * Utilidades para cálculo de periodos y filtrado de obligaciones
 */

const GENERAL_OBLIGATION_PATTERNS = [
    /informes?\s+mensual(es)?/i,
    /supervisor.*interventor/i,
    /plataforma.*secop/i,
    /modelo\s+integrado\s+de\s+planeaci[oó]n/i,
    /mipg/i,
    /aportes?.*seguridad\s+social/i,
    /lealtad\s+y\s+buena\s+fe/i,
    /formato\s+[uú]nico\s+de\s+inventario/i,
    /archivos?\s+documental(es)?/i,
    /riesgos?\s+laboral(es)?/i,
    /sg-sst/i,
    /reserva\s+y\s+confidencialidad/i,
    /no\s+acceder\s+a\s+peticiones/i
];

/**
 * Determina si un texto corresponde a una obligación general del contratista
 * @param {string} text 
 * @returns {boolean}
 */
const isGeneralObligation = (text) => {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (/^2\.1(\.|\s|$)/i.test(trimmed)) return true;
    return GENERAL_OBLIGATION_PATTERNS.some(regex => regex.test(trimmed));
};

/**
 * Filtra un arreglo de actividades/obligaciones dejando únicamente las específicas
 * @param {Array<string>} activities 
 * @returns {Array<string>}
 */
const filterSpecificObligations = (activities) => {
    if (!Array.isArray(activities)) return [];
    const filtered = activities.filter(act => !isGeneralObligation(act));
    return filtered.length > 0 ? filtered : activities;
};

/**
 * Formatea un objeto Date a string YYYY-MM-DD sin desfaces de zona horaria
 */
const formatDateStr = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * Calcula los periodos de cobro de un contrato de forma dinámica
 * @param {string} startDateStr - Fecha de inicio del contrato (YYYY-MM-DD)
 * @param {number} initialMonths - Cantidad de periodos/meses iniciales (ej: 4)
 * @param {number} additionMonths - Cantidad de periodos/meses de adición (ej: 2)
 * @param {string} periodType - Tipo de periodo ('mes_cumplido' o '30_dias')
 * @param {string} [endDateStr] - Fecha de terminación oficial del contrato (opcional, YYYY-MM-DD)
 * @returns {Array} - Listado de periodos con fechas exactas
 */
const calculatePeriods = (startDateStr, initialMonths = 4, additionMonths = 0, periodType = 'mes_cumplido', endDateStr = null) => {
    if (!startDateStr) return [];

    let periods = [];
    const totalPeriods = Math.max(1, Number(initialMonths || 4) + Number(additionMonths || 0));
    
    // Parseo seguro de fecha local YYYY-MM-DD
    const rawDatePart = startDateStr.split('T')[0];
    const [y, m, d] = rawDatePart.split('-').map(Number);
    let currentStart = new Date(y, m - 1, d);

    let parsedEnd = null;
    if (endDateStr) {
        const rawEndPart = endDateStr.split('T')[0];
        const [ey, em, ed] = rawEndPart.split('-').map(Number);
        if (!isNaN(ey) && !isNaN(em) && !isNaN(ed)) {
            parsedEnd = new Date(ey, em - 1, ed);
        }
    }
    
    for (let i = 1; i <= totalPeriods; i++) {
        let currentEnd;
        
        if (periodType === '30_dias') {
            // Cada periodo dura exactamente 30 días calendario
            // Sumamos 29 días a la fecha de inicio para que el periodo sea de 30 días inclusivo
            // Ej: 28 de agosto al 26 de septiembre (4 días en agosto + 26 en sept = 30 días)
            currentEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() + 29);
        } else {
            // Modalidad "Mes Cumplido"
            // El periodo va del día X al día X - 1 del siguiente mes
            // Ej: 28 de agosto al 27 de septiembre
            const startYear = currentStart.getFullYear();
            const startMonth = currentStart.getMonth();
            const startDay = currentStart.getDate();
            
            const nextMonth = startMonth + 1;
            const daysInNextMonth = new Date(startYear, nextMonth + 1, 0).getDate();
            const anchorDay = Math.min(startDay, daysInNextMonth);
            const anchorDate = new Date(startYear, nextMonth, anchorDay);
            currentEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() - 1);
        }

        // Si se especificó endDateStr y es el último periodo o el fin excede el término del contrato
        if (parsedEnd && (i === totalPeriods || currentEnd > parsedEnd)) {
            if (currentStart <= parsedEnd) {
                currentEnd = new Date(parsedEnd);
            }
        }
        
        periods.push({
            actNumber: i,
            from: formatDateStr(currentStart),
            to: formatDateStr(currentEnd),
            isAddition: i > Number(initialMonths || 4)
        });
        
        // El siguiente periodo inicia al día siguiente del fin del periodo actual
        currentStart = new Date(currentEnd.getFullYear(), currentEnd.getMonth(), currentEnd.getDate() + 1);
        if (parsedEnd && currentStart > parsedEnd) {
            break;
        }
    }
    
    return periods;
};

/**
 * Determina y formatea el plazo o duración de un contrato (en días o meses)
 * @param {Object} contract - Objeto con datos del contrato
 * @returns {string} - Texto descriptivo ej: "115 días", "4 meses", "6 meses (4 iniciales + 2 adición)"
 */
const getContractDurationText = (contract) => {
    if (!contract) return 'Pendiente';

    // 1. Detectar si el texto de endDate o periodType indica días
    const hasDaysText = contract.endDate && /d[ií]as?/i.test(String(contract.endDate));
    const isByDays = contract.periodType === '30_dias' || hasDaysText;

    let diffDays = null;

    // Intentar calcular días entre startDate y endDate si son fechas válidas
    if (contract.startDate && contract.endDate) {
        try {
            const rawStart = String(contract.startDate).split('T')[0].trim();
            const rawEnd = String(contract.endDate).split('T')[0].trim();
            const [sy, sm, sd] = rawStart.split('-').map(Number);
            const [ey, em, ed] = rawEnd.split('-').map(Number);
            if (!isNaN(sy) && !isNaN(sm) && !isNaN(sd) && !isNaN(ey) && !isNaN(em) && !isNaN(ed)) {
                const start = new Date(sy, sm - 1, sd);
                const end = new Date(ey, em - 1, ed);
                const diffTime = end.getTime() - start.getTime();
                if (diffTime >= 0) {
                    diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
                }
            }
        } catch (_) {}
    }

    // Si no se pudo calcular por fechas, verificar si endDate tiene un número de días en texto
    if (!diffDays && contract.endDate) {
        const match = String(contract.endDate).match(/(\d+)\s*d[ií]as?/i);
        if (match) {
            diffDays = parseInt(match[1], 10);
        }
    }

    if (isByDays) {
        if (diffDays) {
            return `${diffDays} días`;
        }
        if (contract.initialDurationMonths) {
            return `${contract.initialDurationMonths * 30} días (${contract.initialDurationMonths} periodos)`;
        }
        return 'Por días';
    } else {
        // Por meses (mes_cumplido)
        const months = Number(contract.initialDurationMonths) || 0;
        const addMonths = contract.hasAddition ? (Number(contract.additionDurationMonths) || 0) : 0;
        const totalMonths = months + addMonths;

        if (totalMonths > 0) {
            if (addMonths > 0) {
                return `${totalMonths} meses (${months} iniciales + ${addMonths} adición)`;
            }
            return `${months} ${months === 1 ? 'mes' : 'meses'}`;
        }

        if (diffDays) {
            const approxMonths = Math.round(diffDays / 30);
            return `${approxMonths} ${approxMonths === 1 ? 'mes' : 'meses'} (${diffDays} días)`;
        }

        return 'Por meses';
    }
};

module.exports = {
    calculatePeriods,
    isGeneralObligation,
    filterSpecificObligations,
    formatDateStr,
    getContractDurationText
};

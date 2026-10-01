/**
 * Utilidades para cálculo de periodos y filtrado de obligaciones en frontend
 */

export const GENERAL_OBLIGATION_PATTERNS = [
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

export const isGeneralObligation = (text) => {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (/^2\.1(\.|\s|$)/i.test(trimmed)) return true;
    return GENERAL_OBLIGATION_PATTERNS.some(regex => regex.test(trimmed));
};

export const filterSpecificObligations = (activities) => {
    if (!Array.isArray(activities)) return [];
    const filtered = activities.filter(act => !isGeneralObligation(act));
    return filtered.length > 0 ? filtered : activities;
};

export const formatDateStr = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const calculatePeriods = (startDateStr, initialMonths = 4, additionMonths = 0, periodType = 'mes_cumplido', endDateStr = null) => {
    if (!startDateStr) return [];

    let periods = [];
    const totalPeriods = Math.max(1, Number(initialMonths || 4) + Number(additionMonths || 0));
    
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
            // Cada periodo dura 30 días calendario (inicio + 29 días)
            currentEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() + 29);
        } else {
            // Mes Cumplido: va del día X al día X - 1 del mes siguiente
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
export const getContractDurationText = (contract) => {
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

/**
 * Determina el número de acta activa (periodo actual para recolección de evidencias / trámite de cuenta)
 * considerando:
 * 1. Fecha de inicio del contrato y el tiempo calendario transcurrido a la fecha actual.
 * 2. Si el periodo 1 ya venció (ej: inició el 28 de agosto y hoy es después del 30 de septiembre),
 *    se asume que la Cuenta 1 ya fue radicada y el contratista inicia en el Acta 2 (Cuenta 2).
 * 3. Si el periodo 1 aún está dentro de su ventana de vigencia (ej: inició el 13 de septiembre y
 *    vence el 12 de octubre), se mantiene en el Acta 1 (Cuenta 1).
 * 4. Historial previo en base de datos: si ya descargó el Acta N o fue completada, avanza al siguiente.
 *
 * @param {Object} contract - Contrato
 * @param {Array} [existingPeriods=[]] - Periodos existentes en BD
 * @param {Date|string} [currentDate=new Date()] - Fecha a evaluar
 * @returns {Object} { targetAct, currentPeriod, periods, reason }
 */
export const determineActiveAct = (contract, existingPeriods = [], currentDate = new Date()) => {
    if (!contract || !contract.startDate) {
        return { targetAct: 1, currentPeriod: null, periods: [], reason: 'Contrato sin fecha de inicio definida' };
    }

    const periods = calculatePeriods(
        contract.startDate,
        contract.initialDurationMonths || 4,
        contract.additionDurationMonths || 0,
        contract.periodType || '30_dias',
        contract.endDate
    );

    if (!periods || periods.length === 0) {
        return { targetAct: 1, currentPeriod: null, periods: [], reason: 'No hay periodos calculados' };
    }

    const now = (currentDate instanceof Date) ? currentDate : new Date(currentDate);

    // 1. Si ya tiene actas descargadas/completadas en el sistema, partir de maxDownloaded + 1
    const downloadedPeriods = (existingPeriods || []).filter(p => p.zipDownloaded || p.status === 'completed');
    let baseFromDb = 1;
    if (downloadedPeriods.length > 0) {
        baseFromDb = Math.max(...downloadedPeriods.map(p => p.actNumber)) + 1;
    }

    // 2. Determinar acta según calendario y fecha de inicio
    let calendarAct = 1;
    for (const p of periods) {
        const rawTo = String(p.to).split('T')[0];
        const [toY, toM, toD] = rawTo.split('-').map(Number);
        const lastDayOfToMonth = new Date(toY, toM, 0).getDate();

        // Si toD >= 20, el corte formal de radicación de la cuenta es el último día del mes (ej: 30 de septiembre).
        // Si toD < 20, el corte es el mismo día de cierre del periodo de 30 días (ej: 12 de octubre).
        let cutoffDate;
        if (toD >= 20) {
            cutoffDate = new Date(toY, toM - 1, lastDayOfToMonth, 23, 59, 59);
        } else {
            cutoffDate = new Date(toY, toM - 1, toD, 23, 59, 59);
        }

        if (now > cutoffDate) {
            // Este periodo ya venció en el calendario
            calendarAct = p.actNumber + 1;
        } else {
            // Encontró el periodo vigente
            calendarAct = p.actNumber;
            break;
        }
    }

    // Garantizar que no exceda el número total de periodos
    calendarAct = Math.min(calendarAct, periods.length);
    const targetAct = Math.max(baseFromDb, calendarAct);
    const currentPeriod = periods.find(p => p.actNumber === targetAct) || periods[periods.length - 1];

    let reason = 'El contrato se encuentra dentro del plazo de vigencia del periodo actual.';
    if (targetAct > 1) {
        const startClean = String(contract.startDate).split('T')[0];
        reason = `Por la fecha de inicio del contrato (${startClean}) y el tiempo transcurrido, el Acta ${targetAct - 1} ya finalizó. Se gestiona el Acta ${targetAct}.`;
    }

    return {
        targetAct,
        currentPeriod,
        periods,
        reason
    };
};


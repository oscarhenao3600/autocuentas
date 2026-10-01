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

    // 1. Detectar si el texto de endDate, executionTerm o periodType indica días
    const hasDaysText = (contract.endDate && /d[ií]as?/i.test(String(contract.endDate))) ||
                        (contract.executionTerm && /d[ií]as?/i.test(String(contract.executionTerm)));
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

    // Si no se pudo calcular por fechas, verificar si executionTerm o endDate tiene un número de días en texto
    if (!diffDays && contract.executionTerm) {
        const match = String(contract.executionTerm).match(/(\d+)\s*d[ií]as?/i);
        if (match) {
            diffDays = parseInt(match[1], 10);
        }
    }
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

const MONTHS_SPANISH = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Calcula y liquida los aportes de Seguridad Social respetando la normativa PILA en Colombia:
 * - Redondeo legal a la centena superior (Math.ceil a múltiplos de 100).
 * - Prorrateo estricto por días laborados en el mes inicial si el contrato inicia a mitad de mes.
 * - Liquidación mensual completa (30 días) para la Cuenta 2 y periodos ordinarios.
 * - Prioridad absoluta a los valores reales de la planilla si el usuario la cargó.
 */
const calculateSocialSecurity = (contract, period = {}, uploadedSS = {}) => {
    const defaultSmmlv = parseInt(process.env.SMMLV || '1750910', 10);
    const smmlv = Number(contract?.smmlv || defaultSmmlv);
    const monthlyVal = parseFloat(contract?.monthlyValue || 0);
    const actNum = Number(period?.actNumber || 1);

    // 1. Si el usuario subió planilla y contiene valores reales, priorizarlos
    const rawIbc = Number(uploadedSS?.ibc || period?.securitySocial?.ibc || 0);
    const rawSalud = Number(uploadedSS?.saludPaid || period?.securitySocial?.saludPaid || 0);
    const rawPension = Number(uploadedSS?.pensionPaid || period?.securitySocial?.pensionPaid || 0);
    const rawArl = Number(uploadedSS?.arlPaid || period?.securitySocial?.arlPaid || 0);
    const rawTotal = Number(uploadedSS?.totalPaid || period?.securitySocial?.totalPaid || 0);

    const hasRealUploadedData = rawSalud > 0 || rawPension > 0 || rawIbc > 0 || rawTotal > 0;

    if (hasRealUploadedData) {
        const computedIbc = rawIbc > 0 ? rawIbc : (
            rawSalud > 0 ? Math.round(rawSalud / 0.125) : (
                rawPension > 0 ? Math.round(rawPension / 0.16) : smmlv
            )
        );
        const computedSalud = rawSalud > 0 ? rawSalud : Math.ceil((computedIbc * 0.125) / 100) * 100;
        const computedPension = rawPension > 0 ? rawPension : Math.ceil((computedIbc * 0.16) / 100) * 100;
        const computedArl = rawArl > 0 ? rawArl : Math.max(1000, Math.ceil((computedIbc * 0.00522) / 100) * 100);
        const subtotal = computedSalud + computedPension + computedArl;
        const finalTotal = rawTotal > 0 ? rawTotal : subtotal;

        return {
            operator: uploadedSS?.operator || period?.securitySocial?.operator || 'SIMPLE',
            planillaNumber: uploadedSS?.planillaNumber || period?.securitySocial?.planillaNumber || '',
            ibc: computedIbc,
            days: Number(uploadedSS?.days || period?.securitySocial?.days || (actNum === 1 ? 3 : 30)),
            saludPaid: computedSalud,
            pensionPaid: computedPension,
            arlPaid: computedArl,
            totalPaid: finalTotal,
            interests: Number(uploadedSS?.interests || period?.securitySocial?.interests || 0),
            paymentDate: uploadedSS?.paymentDate || period?.securitySocial?.paymentDate || '',
            period: uploadedSS?.period || period?.securitySocial?.period || '',
            periodCotizadoInicio: uploadedSS?.periodCotizadoInicio || period?.securitySocial?.periodCotizadoInicio || '',
            periodCotizadoFin: uploadedSS?.periodCotizadoFin || period?.securitySocial?.periodCotizadoFin || ''
        };
    }

    // 2. Liquidación teórica automática
    let startDateObj = null;
    if (contract?.startDate) {
        const rawDate = String(contract.startDate).split('T')[0];
        const [y, m, d] = rawDate.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            startDateObj = new Date(y, m - 1, d);
        }
    }

    const isFirstAct = actNum === 1;
    const isMidMonthStart = startDateObj && startDateObj.getDate() > 1;

    let days = 30;
    let ibc = 0;
    let periodCotizadoInicio = '';
    let periodCotizadoFin = '';
    let periodName = '';

    if (isFirstAct && isMidMonthStart) {
        // Cuenta 1 con inicio a mitad de mes (ej: 28 de agosto -> 3 días)
        const startDay = startDateObj.getDate();
        // Mes comercial de 30 días en PILA: días = 30 - startDay + 1
        days = Math.max(1, 30 - startDay + 1);
        
        // IBC proporcional al salario mínimo base por los días laborados
        const dailyMin = smmlv / 30;
        const proportionalMinIbc = Math.round(dailyMin * days);
        const proportionalContractIbc = Math.round(((monthlyVal * 0.4) / 30) * days);

        ibc = Math.max(proportionalMinIbc, proportionalContractIbc);

        const pad = (n) => String(n).padStart(2, '0');
        const startMonth = startDateObj.getMonth() + 1;
        const startYear = startDateObj.getFullYear();

        periodCotizadoInicio = `${pad(startDay)} - ${pad(startMonth)} - ${startYear}`;
        periodCotizadoFin = `30 - ${pad(startMonth)} - ${startYear}`;
        periodName = `${MONTHS_SPANISH[startDateObj.getMonth()]} de ${startYear}`;
    } else {
        // Cuenta 2 en adelante o contratos iniciados el día 1 (mes completo de 30 días)
        days = 30;
        const fullForty = Math.round(monthlyVal * 0.4);
        ibc = Math.max(fullForty, smmlv);

        // Para Cuenta 2 (y subsecuentes), la planilla cotizada corresponde al mes de labores concluido
        let cotizedMonthIndex = 0;
        let cotizedYear = 2026;

        if (period?.periodFrom) {
            const rawFrom = String(period.periodFrom).split('T')[0];
            const [fy, fm] = rawFrom.split('-').map(Number);
            if (!isNaN(fy) && !isNaN(fm)) {
                // El mes de labores que se paga
                cotizedMonthIndex = fm - 1; // 0-based
                cotizedYear = fy;
            }
        } else if (startDateObj) {
            // Estimar mes según número de acta
            const baseMonth = startDateObj.getMonth() + (actNum - 1);
            cotizedMonthIndex = baseMonth % 12;
            cotizedYear = startDateObj.getFullYear() + Math.floor(baseMonth / 12);
        }

        const pad = (n) => String(n).padStart(2, '0');
        const mNum = pad(cotizedMonthIndex + 1);

        periodCotizadoInicio = `01 - ${mNum} - ${cotizedYear}`;
        periodCotizadoFin = `30 - ${mNum} - ${cotizedYear}`;
        periodName = `${MONTHS_SPANISH[cotizedMonthIndex]} de ${cotizedYear}`;
    }

    // Tarifas y redondeo PILA a la centena superior
    const saludPaid = Math.ceil((ibc * 0.125) / 100) * 100;
    const pensionPaid = Math.ceil((ibc * 0.16) / 100) * 100;
    const arlPaid = Math.max(1000, Math.ceil((ibc * 0.00522) / 100) * 100);
    const totalPaid = saludPaid + pensionPaid + arlPaid;

    return {
        operator: 'SIMPLE',
        planillaNumber: '',
        ibc,
        days,
        saludPaid,
        pensionPaid,
        arlPaid,
        totalPaid,
        interests: 0,
        paymentDate: '',
        period: periodName,
        periodCotizadoInicio,
        periodCotizadoFin
    };
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
const determineActiveAct = (contract, existingPeriods = [], currentDate = new Date()) => {
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

module.exports = {
    calculatePeriods,
    calculateSocialSecurity,
    determineActiveAct,
    isGeneralObligation,
    filterSpecificObligations,
    formatDateStr,
    getContractDurationText
};


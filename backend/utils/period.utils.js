/**
 * Calcula los periodos de cobro de un contrato de forma dinámica
 * @param {string} startDateStr - Fecha de inicio del contrato (YYYY-MM-DD)
 * @param {number} initialMonths - Cantidad de periodos/meses iniciales (ej: 4)
 * @param {number} additionMonths - Cantidad de periodos/meses de adición (ej: 2)
 * @param {string} periodType - Tipo de periodo ('mes_cumplido' o '30_dias')
 * @returns {Array} - Listado de periodos con fechas exactas
 */
exports.calculatePeriods = (startDateStr, initialMonths, additionMonths = 0, periodType = 'mes_cumplido') => {
    if (!startDateStr) return [];

    let periods = [];
    const totalPeriods = Number(initialMonths) + Number(additionMonths || 0);
    
    // Forzamos zona horaria local al parsear la fecha YYYY-MM-DD
    let currentStart = new Date(startDateStr + 'T00:00:00');
    
    for (let i = 1; i <= totalPeriods; i++) {
        let currentEnd = new Date(currentStart);
        
        if (periodType === '30_dias') {
            // Cada periodo dura exactamente 30 días calendario
            // Sumamos 29 días a la fecha de inicio para que el periodo sea de 30 días inclusivo
            currentEnd.setDate(currentStart.getDate() + 29);
        } else {
            // Modalidad "Mes Cumplido"
            // El periodo va del día X al día X-1 del siguiente mes
            currentEnd.setMonth(currentEnd.getMonth() + 1);
            currentEnd.setDate(currentEnd.getDate() - 1);
        }
        
        periods.push({
            actNumber: i,
            from: currentStart.toISOString().split('T')[0],
            to: currentEnd.toISOString().split('T')[0],
            isAddition: i > Number(initialMonths)
        });
        
        // El siguiente periodo inicia al día siguiente del fin del periodo actual
        currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate() + 1);
    }
    
    return periods;
};

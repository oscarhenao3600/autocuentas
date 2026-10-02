const { calculatePeriods, determineActiveAct, formatDateStr } = require('../utils/period.utils');

function runTests() {
    console.log('=== TEST: CÁLCULO DE PERIODOS Y CIERRE ESPECIAL DE DICIEMBRE ===\n');

    // 1. Contrato de 4 meses: 2026-08-28 a diciembre
    const contractStandard = {
        startDate: '2026-08-28',
        initialDurationMonths: 4,
        additionDurationMonths: 0,
        periodType: 'mes_cumplido'
    };

    console.log('1. Periodos estándar sin fecha personalizada:');
    const periodsStd = calculatePeriods(contractStandard.startDate, contractStandard.initialDurationMonths, 0, 'mes_cumplido');
    periodsStd.forEach(p => console.log(`   Acta ${p.actNumber}: ${p.from} al ${p.to} (isCustomCutoff: ${p.isCustomCutoff})`));

    // 2. Contrato con fecha de entrega anticipada de diciembre: 2026-12-16
    const contractWithDecDelivery = {
        ...contractStandard,
        customDeliveryDate: '2026-12-16',
        deliveryNotes: 'Cierre fiscal Tesorería Armenia vigencia 2026'
    };

    console.log('\n2. Periodos con fecha de entrega anticipada de diciembre (2026-12-16):');
    const periodsCustom = calculatePeriods(
        contractWithDecDelivery.startDate,
        contractWithDecDelivery.initialDurationMonths,
        0,
        'mes_cumplido',
        null,
        contractWithDecDelivery.customDeliveryDate
    );
    periodsCustom.forEach(p => console.log(`   Acta ${p.actNumber}: ${p.from} al ${p.to} (isCustomCutoff: ${p.isCustomCutoff})`));

    const p4 = periodsCustom.find(p => p.actNumber === 4);
    if (p4.to !== '2026-12-16' || !p4.isCustomCutoff) {
        throw new Error(`FALLO: Se esperaba que el Acta 4 finalizara el 2026-12-16 con isCustomCutoff=true, pero se obtuvo to=${p4.to}, isCustomCutoff=${p4.isCustomCutoff}`);
    }
    console.log('✅ Acta 4 ajustó correctamente su corte a 2026-12-16.');

    // 3. Evaluar determineActiveAct durante la prórroga de 5 días del cierre de diciembre (ej: 2026-12-18)
    console.log('\n3. Evaluando determineActiveAct el 18 de Diciembre de 2026 (en prórroga de 5 días tras corte del 16):');
    const testDateDuringGrace = new Date('2026-12-18T10:00:00');
    // Acta 1, 2, 3 descargadas, Acta 4 sin descargar
    const existingPeriods = [
        { actNumber: 1, zipDownloaded: true, status: 'completed' },
        { actNumber: 2, zipDownloaded: true, status: 'completed' },
        { actNumber: 3, zipDownloaded: true, status: 'completed' }
    ];

    const activeInfoGrace = determineActiveAct(contractWithDecDelivery, existingPeriods, testDateDuringGrace);
    console.log(`   Target Act: ${activeInfoGrace.targetAct}`);
    console.log(`   Has unfinished previous act: ${activeInfoGrace.hasUnfinishedPreviousAct} (Act ${activeInfoGrace.unfinishedPreviousAct})`);
    console.log(`   In grace period: ${activeInfoGrace.inGracePeriod}`);
    console.log(`   Grace days remaining: ${activeInfoGrace.graceDaysRemaining}`);
    console.log(`   Grace end date: ${activeInfoGrace.graceEndDate}`);

    const p4Enriched = activeInfoGrace.periods.find(p => p.actNumber === 4);
    console.log(`   P4 Cutoff Date: ${p4Enriched.cutoffDate.toISOString()}`);
    console.log(`   P4 Grace End Date: ${p4Enriched.graceEndDate.toISOString()}`);

    if (!p4Enriched.inGrace) {
        throw new Error(`FALLO: El Acta 4 debería estar en prórroga el 18 de Diciembre`);
    }
    console.log('✅ El Acta 4 se encuentra en prórroga de 5 días tras su entrega anticipada.');

    // 4. Evaluar transición dinámica entre cualquier cuenta (ej: Cuenta 2 finalizada, Cuenta 3 en curso)
    console.log('\n4. Evaluando transición dinámica Cuenta 2 -> Cuenta 3 el 01 de Noviembre de 2026:');
    const testDateNov = new Date('2026-11-01T10:00:00'); // Pasó el corte de Cuenta 2 (27 de octubre)
    const existingP1Only = [
        { actNumber: 1, zipDownloaded: true, status: 'completed' }
        // Cuenta 2 no completada aún
    ];
    const activeInfoTransition2to3 = determineActiveAct(contractWithDecDelivery, existingP1Only, testDateNov);
    console.log(`   Target Act: ${activeInfoTransition2to3.targetAct}`);
    console.log(`   Unfinished Previous Act: ${activeInfoTransition2to3.unfinishedPreviousAct}`);
    console.log(`   Has Transition Pending: ${activeInfoTransition2to3.hasTransitionPending}`);
    console.log(`   Can Start Next Act: ${activeInfoTransition2to3.canStartNextAct}`);
    console.log(`   Reason: ${activeInfoTransition2to3.reason}`);

    if (activeInfoTransition2to3.unfinishedPreviousAct !== 2 || activeInfoTransition2to3.targetAct !== 3) {
        throw new Error(`FALLO: Transición 2 -> 3 no detectada correctamente`);
    }
    console.log('✅ Transición dinámica entre Cuenta 2 y Cuenta 3 validada exitosamente.');

    // 5. Evaluar adición contractual con cierre de diciembre
    console.log('\n5. Contrato con adición de 2 meses y cierre de diciembre:');
    const contractAddition = {
        startDate: '2026-06-01',
        initialDurationMonths: 4, // 1: jun, 2: jul, 3: ago, 4: sep
        additionDurationMonths: 3, // 5: oct, 6: nov, 7: dic
        periodType: 'mes_cumplido',
        customDeliveryDate: '2026-12-15'
    };
    const periodsAdd = calculatePeriods(
        contractAddition.startDate,
        contractAddition.initialDurationMonths,
        contractAddition.additionDurationMonths,
        contractAddition.periodType,
        null,
        contractAddition.customDeliveryDate
    );
    periodsAdd.forEach(p => console.log(`   Acta ${p.actNumber} (${p.isAddition ? 'Adición' : 'Inicial'}): ${p.from} al ${p.to} (isCustomCutoff: ${p.isCustomCutoff})`));

    const p7 = periodsAdd.find(p => p.actNumber === 7);
    if (p7.to !== '2026-12-15' || !p7.isCustomCutoff) {
        throw new Error(`FALLO: El Acta 7 de adición debería terminar el 2026-12-15 con isCustomCutoff=true`);
    }
    console.log('✅ Acta 7 de adición ajustó correctamente su corte a 2026-12-15.');

    console.log('\n🎉 ¡TODOS LOS TESTS DE PERIODOS Y CIERRE DE DICIEMBRE PASARON EXITOSAMENTE!');
}

runTests();

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { determineActiveAct, calculatePeriods } = require('../utils/period.utils');

console.log('=== TEST 1: Unit tests for determineActiveAct ===');

// Contract starting 2026-08-28 (Period 1 ends 2026-09-27, cutoff 2026-09-30)
const contractAug28 = {
    startDate: '2026-08-28',
    initialDurationMonths: 4,
    additionDurationMonths: 2,
    periodType: '30_dias'
};

// Evaluate on 2026-10-01 (Day 1 of 5-day grace period for Period 1, Period 2 has begun)
const evalDateOct1 = new Date('2026-10-01T12:00:00');
const periodsDbPending = [{ actNumber: 1, zipDownloaded: false, status: 'pending' }];

const resOct1 = determineActiveAct(contractAug28, periodsDbPending, evalDateOct1);
console.log('\n--- Scenario B (In Grace Period Oct 1): ---');
console.log('targetAct:', resOct1.targetAct);
console.log('hasTransitionPending:', resOct1.hasTransitionPending);
console.log('unfinishedPreviousAct:', resOct1.unfinishedPreviousAct);
console.log('inGracePeriod:', resOct1.inGracePeriod);
console.log('graceDaysRemaining:', resOct1.graceDaysRemaining);
console.log('canStartNextAct:', resOct1.canStartNextAct);
console.log('reason:', resOct1.reason);

if (resOct1.targetAct === 2 && resOct1.hasTransitionPending && resOct1.inGracePeriod && resOct1.unfinishedPreviousAct === 1) {
    console.log('✅ Scenario B PASSED!');
} else {
    console.error('❌ Scenario B FAILED!');
    process.exit(1);
}

// Evaluate with Period 1 already completed
const periodsDbCompleted = [{ actNumber: 1, zipDownloaded: true, status: 'completed' }];
const resCompleted = determineActiveAct(contractAug28, periodsDbCompleted, evalDateOct1);
console.log('\n--- Scenario C (Period 1 already completed): ---');
console.log('targetAct:', resCompleted.targetAct);
console.log('hasTransitionPending:', resCompleted.hasTransitionPending);
console.log('inGracePeriod:', resCompleted.inGracePeriod);

if (resCompleted.targetAct === 2 && !resCompleted.hasTransitionPending && !resCompleted.inGracePeriod) {
    console.log('✅ Scenario C PASSED!');
} else {
    console.error('❌ Scenario C FAILED!');
    process.exit(1);
}

// Evaluate after grace period expires (e.g. 2026-10-10) with Period 1 still unfinished
const evalDateOct10 = new Date('2026-10-10T12:00:00');
const resOct10 = determineActiveAct(contractAug28, periodsDbPending, evalDateOct10);
console.log('\n--- Scenario D (After 5-day grace period, e.g. Oct 10): ---');
console.log('targetAct:', resOct10.targetAct);
console.log('hasTransitionPending:', resOct10.hasTransitionPending);
console.log('unfinishedPreviousAct:', resOct10.unfinishedPreviousAct);
console.log('inGracePeriod:', resOct10.inGracePeriod);
console.log('canStartNextAct:', resOct10.canStartNextAct);

if (resOct10.targetAct === 2 && resOct10.hasTransitionPending && !resOct10.inGracePeriod && resOct10.unfinishedPreviousAct === 1) {
    console.log('✅ Scenario D PASSED!');
} else {
    console.error('❌ Scenario D FAILED!');
    process.exit(1);
}

console.log('\n🎉 ALL PERIOD TRANSITION TESTS PASSED SUCCESSFULLY!');
process.exit(0);

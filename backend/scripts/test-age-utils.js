const { isSeniorByCedula, getSeniorStatus, getEffectiveUiMode, formatKeyboardForMode } = require('../utils/age.utils');

console.log("=== INICIANDO PRUEBAS DE DETECCIÓN POR CÉDULA Y MODO SENIOR ===");

const testCases = [
    // 10 digits -> Young / Adult (<45 years)
    { cedula: '1094912345', expectedSenior: false, desc: 'Cédula Quindío 10 dígitos (NUIP)' },
    { cedula: '1020345678', expectedSenior: false, desc: 'Cédula Bogotá 10 dígitos (NUIP)' },
    { cedula: '1.115.890.123', expectedSenior: false, desc: 'Cédula con puntos 10 dígitos' },

    // 1 to 7 digits (< 10M) -> Age >= 72 years
    { cedula: '4192345', expectedSenior: true, desc: 'Cédula 7 dígitos antigua (< 10M)' },
    { cedula: '7564123', expectedSenior: true, desc: 'Cédula 7 dígitos (< 10M)' },
    { cedula: '9845120', expectedSenior: true, desc: 'Cédula 7 dígitos (< 10M)' },

    // 8 digits men (< 20M) -> Age >= 60 years
    { cedula: '14234567', expectedSenior: true, desc: 'Cédula Valle/Bogotá 14M (< 20M)' },
    { cedula: '18999999', expectedSenior: true, desc: 'Cédula hombre 18M (< 20M)' },

    // 8 digits women (20M - 43M) -> Age >= 60 years
    { cedula: '24567890', expectedSenior: true, desc: 'Cédula mujer serie 24M (60+ años)' },
    { cedula: '31876543', expectedSenior: true, desc: 'Cédula mujer serie 31M (60+ años)' },
    { cedula: '41987654', expectedSenior: true, desc: 'Cédula mujer serie 41M (60+ años)' },

    // 8 digits women / men between 44M and 99M -> 45-59 years
    { cedula: '52345678', expectedSenior: false, desc: 'Cédula mujer 52M (45-59 años)' },
    { cedula: '71234567', expectedSenior: false, desc: 'Cédula 71M (45-59 años)' }
];

let allPassed = true;
for (const tc of testCases) {
    const res = isSeniorByCedula(tc.cedula);
    const status = getSeniorStatus(tc.cedula);
    const pass = res === tc.expectedSenior;
    if (!pass) allPassed = false;
    console.log(`${pass ? '✅' : '❌'} [${tc.desc}] ${tc.cedula} -> Senior: ${res} (Esperado: ${tc.expectedSenior}) | Grupo: ${status.estimatedAgeGroup}`);
}

// Test UI Mode resolution
const userSenior = { uiMode: 'senior' };
const userStandard = { uiMode: 'standard' };
const userDefault = { uiMode: null };
const contractOld = { idNumber: '7564123' };
const contractYoung = { idNumber: '1094912345' };

console.log("\n--- PRUEBAS DE RESOLUCIÓN DE MODO UI ---");
console.log("1. Usuario con preferencia explícita senior:", getEffectiveUiMode(userSenior, contractYoung) === 'senior' ? '✅' : '❌');
console.log("2. Usuario con preferencia explícita estándar:", getEffectiveUiMode(userStandard, contractOld) === 'standard' ? '✅' : '❌');
console.log("3. Usuario por defecto con contrato de adulto mayor:", getEffectiveUiMode(userDefault, contractOld) === 'senior' ? '✅' : '❌');
console.log("4. Usuario por defecto con contrato joven:", getEffectiveUiMode(userDefault, contractYoung) === 'standard' ? '✅' : '❌');

// Test Keyboard Formatting
const multiColKeyboard = [
    [{ text: 'Botón 1' }, { text: 'Botón 2' }],
    [{ text: 'Botón 3' }]
];
const seniorKeyboard = formatKeyboardForMode(multiColKeyboard, 'senior');
console.log("\n--- PRUEBA DE BOTONES DE 1 COLUMNA (SENIOR) ---");
console.log("Original rows:", multiColKeyboard.length, "-> Senior rows:", seniorKeyboard.length);
if (seniorKeyboard.length === 3 && seniorKeyboard.every(row => row.length === 1)) {
    console.log("✅ Teclado convertido exitosamente a 1 botón por fila para accesibilidad.");
} else {
    console.log("❌ Error en formato de teclado senior.");
    allPassed = false;
}

if (allPassed) {
    console.log("\n🎉 TODAS LAS PRUEBAS DE CÉDULA Y ACCESIBILIDAD PASARON CORRECTAMENTE!");
} else {
    console.error("\n❌ ALGUNAS PRUEBAS FALLARON.");
    process.exit(1);
}

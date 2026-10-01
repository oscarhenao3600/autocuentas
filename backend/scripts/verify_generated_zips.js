const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

function verifyZip(zipRelPath, expected) {
    const fullZipPath = path.resolve(__dirname, '..', zipRelPath);
    console.log(`\n====================================================`);
    console.log(`🔍 VERIFYING ZIP: ${path.basename(fullZipPath)}`);
    console.log(`====================================================`);

    if (!fs.existsSync(fullZipPath)) {
        console.error(`❌ ZIP file does not exist: ${fullZipPath}`);
        return false;
    }

    const zip = new PizZip(fs.readFileSync(fullZipPath));
    const fileNames = Object.keys(zip.files);
    console.log(`📁 Files in zip (${fileNames.length}):\n  - ` + fileNames.join('\n  - '));

    let allPassed = true;

    // 1. Verify CERTIFICADO DEL SUPERVISOR
    const certFile = zip.file('1-CERTIFICADO DEL SUPERVISOR.docx');
    if (!certFile) {
        console.error('❌ 1-CERTIFICADO DEL SUPERVISOR.docx missing from ZIP!');
        allPassed = false;
    } else {
        const certDocx = new PizZip(certFile.asNodeBuffer());
        const certText = certDocx.file('word/document.xml').asText().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        
        console.log('\n--- Checking 1-CERTIFICADO DEL SUPERVISOR.docx ---');
        for (const [key, val] of Object.entries(expected.cert)) {
            const ok = certText.includes(val);
            console.log(`  ${ok ? '✅' : '❌'} [CERT] ${key}: "${val}"`);
            if (!ok) allPassed = false;
        }
    }

    // 2. Verify INFORME DE ACTIVIDADES
    const informeFile = zip.file('2-INFORME DE ACTIVIDADES.docx');
    if (!informeFile) {
        console.error('❌ 2-INFORME DE ACTIVIDADES.docx missing from ZIP!');
        allPassed = false;
    } else {
        const informeDocx = new PizZip(informeFile.asNodeBuffer());
        const informeText = informeDocx.file('word/document.xml').asText().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        
        console.log('\n--- Checking 2-INFORME DE ACTIVIDADES.docx ---');
        for (const [key, val] of Object.entries(expected.informe)) {
            const ok = informeText.includes(val);
            console.log(`  ${ok ? '✅' : '❌'} [INFORME] ${key}: "${val}"`);
            if (!ok) allPassed = false;
        }
    }

    // 3. Verify DESCUENTO DE ESTAMPILLAS
    const estampFile = zip.file('3-DESCUENTO DE ESTAMPILLAS.docx');
    if (!estampFile) {
        console.error('❌ 3-DESCUENTO DE ESTAMPILLAS.docx missing from ZIP!');
        allPassed = false;
    } else {
        const estampDocx = new PizZip(estampFile.asNodeBuffer());
        const estampText = estampDocx.file('word/document.xml').asText().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        
        console.log('\n--- Checking 3-DESCUENTO DE ESTAMPILLAS.docx ---');
        const hasCheckboxes = estampText.includes('[ X ]') || estampText.includes('[   ]');
        console.log(`  ${!hasCheckboxes ? '✅' : '❌'} [ESTAMP] No artificial checkboxes: ${!hasCheckboxes}`);
        if (hasCheckboxes) allPassed = false;

        for (const [key, val] of Object.entries(expected.estamp)) {
            const ok = estampText.includes(val);
            console.log(`  ${ok ? '✅' : '❌'} [ESTAMP] ${key}: "${val}"`);
            if (!ok) allPassed = false;
        }
    }

    return allPassed;
}

// Run verifications
const res1 = verifyZip('generated/Cuenta_Cobro_Oscar_Alexander_Henao_Hernandez_Acta_1.zip', {
    cert: {
        dependencia: 'SECRETARIA TIC - 11401',
        rubro: '2.3.2.02.02.009.4599007.077 - 001',
        actaInicioFolio: 'Acta de Inicio (solo la primera vez): 1 folio(s).',
        primeroCheck: 'PRIMERO _ X _',
        segundoEmpty: 'SEGUNDO ___',
        pension: 'Pago de Pensión: $ 28.100',
        salud: 'Pago de Salud: $ 21.900',
        arl: 'ARL: $ 1.000',
        fechaCertificado: '30 - 09 - 2026'
    },
    informe: {
        actaNum: '1',
        saldoPendiente: '8.500.000',
        pension: '28.100',
        salud: '21.900',
        arl: '1.000'
    },
    estamp: {
        fecha: 'septiembre de 2026',
        modalidad: 'PRESTACIÓN DE SERVICIOS DE APOYO A LA GESTION'
    }
});

const res2 = verifyZip('generated/Cuenta_Cobro_Oscar_Alexander_Henao_Hernandez_Acta_2.zip', {
    cert: {
        dependencia: 'SECRETARIA TIC - 11401',
        rubro: '2.3.2.02.02.009.4599007.077 - 001',
        actaInicioFolio: 'Acta de Inicio (solo la primera vez): 0 folio(s).',
        primeroEmpty: 'PRIMERO ___',
        segundoCheck: 'SEGUNDO _ X _',
        pension: 'Pago de Pensión: $ 280.200',
        salud: 'Pago de Salud: $ 218.900',
        arl: 'ARL: $ 9.200',
        saldoRestante: '5.500.000',
        fechaCertificado: '31 - 10 - 2026'
    },
    informe: {
        actaNum: '2',
        saldoPendiente: '5.500.000',
        pension: '280.200',
        salud: '218.900',
        arl: '9.200'
    },
    estamp: {
        fecha: 'octubre de 2026',
        modalidad: 'PRESTACIÓN DE SERVICIOS DE APOYO A LA GESTION'
    }
});

if (res1 && res2) {
    console.log(`\n🎉 ALL VERIFICATIONS PASSED WITH 100% SUCCESS!`);
} else {
    console.error(`\n⚠️ Some verifications failed. Review logs above.`);
    process.exit(1);
}

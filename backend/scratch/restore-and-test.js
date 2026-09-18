const fs = require('fs');
const path = require('path');
const { generateDocument } = require('../services/document.service');

const tplPath = path.join(__dirname, '..', 'templates', 'FORMATO CERTIFICADO DEL SUPERVISOR.docx');
const backupPath = path.join(__dirname, '..', 'templates', 'FORMATO CERTIFICADO DEL SUPERVISOR.docx.bak');

if (!fs.existsSync(backupPath)) {
    console.error("No se encontró el backup original.");
    process.exit(1);
}

// 1. Restaurar plantilla limpia
fs.copyFileSync(backupPath, tplPath);
console.log("🔄 Plantilla original restaurada desde el backup.");

// 2. Generar con datos mock
const mockData = {
    contractorName: "JUAN PEREZ",
    idNumber: "123456",
    contractNumber: "001-2026",
    supervisorName: "CARLOS SUPERVISOR",
    supervisorDependency: "Planeación",
    periodToDate: "03/06/2026",
    bankName: "Bancolombia",
    accountNumber: "12345",
    paymentMethod: "Ahorros",
    monthlyValue: "1.000.000",
    remainingValue: "5.000.000",
    ssPlanilla: "9999",
    ssPension: "100.000",
    ssSalud: "100.000",
    ssArl: "10.000",
    periodFrom: "1 de mayo",
    periodTo: "30 de mayo",
    foliosContratista: "2",
    foliosSupervisor: "1",
    actNumberText: "TERCER PAGO",
    actNumber: "3",
    activities: []
};

generateDocument('FORMATO CERTIFICADO DEL SUPERVISOR.docx', mockData)
    .then(result => {
        console.log("✅ Documento de prueba sin parches generado en:", result.outputPath);
    })
    .catch(err => {
        console.error("❌ Error de generación:", err);
    });

require('dotenv').config();
const { extractContractData } = require('./services/gemini.service');
const { generateDocument } = require('./services/document.service');
const path = require('path');

async function runRealTest() {
    try {
        console.log("=== INICIANDO PRUEBA REAL DE EXTRACCIÓN Y GENERACIÓN ===");
        
        // 1. Archivo de prueba (simulando un PDF, usaremos el TXT que creamos)
        const filePath = path.join(__dirname, 'dummy-contract.txt');
        console.log(`1. Leyendo documento: ${filePath}`);

        // 2. Extraer datos con Gemini
        console.log("2. Enviando documento a Gemini para extraer datos...");
        console.log("   (Esto puede tomar unos segundos)");
        const extractedData = await extractContractData(filePath);
        
        console.log("\n--- DATOS EXTRAÍDOS POR LA IA ---");
        console.log(JSON.stringify(extractedData, null, 2));
        console.log("---------------------------------\n");

        // 3. Generar el documento (Vamos a probar con FORMATO CERTIFICADO DEL SUPERVISOR.docx)
        // Nota: Si el template espera variables específicas que Gemini no extrajo, 
        // simplemente quedarán en blanco o como tags, pero probará el flujo.
        const templateName = "FORMATO CERTIFICADO DEL SUPERVISOR.docx";
        console.log(`3. Generando documento usando plantilla: ${templateName}`);
        
        const result = await generateDocument(templateName, extractedData);
        
        console.log("\n=== PRUEBA EXITOSA ===");
        console.log(`Documento generado correctamente en:\n${result.outputPath}`);

    } catch (error) {
        console.error("Error durante la prueba:", error);
    }
}

runRealTest();

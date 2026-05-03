require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 1. Inicializar el SDK con la API key de las variables de entorno
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testGemini() {
  try {
    console.log("Iniciando prueba con Gemini...");
    
    // 2. Obtener el modelo (usaremos gemini-1.5-flash que es rápido y versátil)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3. Definir el prompt de prueba
    const prompt = "Hola, eres un asistente experto. Escribe un chiste corto sobre programación.";
    
    console.log(`Enviando prompt: "${prompt}"`);

    // 4. Generar el contenido
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("\n--- RESPUESTA DE GEMINI ---");
    console.log(text);
    console.log("---------------------------\n");
    console.log("¡Prueba exitosa! Tu API key de Gemini está funcionando correctamente.");

  } catch (error) {
    console.error("Error al conectar con Gemini:", error.message);
  }
}

testGemini();

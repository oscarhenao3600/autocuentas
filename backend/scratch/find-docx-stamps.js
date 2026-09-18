const fs = require('fs');
const path = require('path');

function findFiles(dir, filter, results = []) {
    if (!fs.existsSync(dir)) return results;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        try {
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                if (!file.startsWith('.') && file !== 'node_modules') {
                    findFiles(filePath, filter, results);
                }
            } else if (filter.test(file)) {
                results.push(filePath);
            }
        } catch (err) {
            // Ignorar errores de acceso
        }
    }
    return results;
}

const searchDir = 'D:\\Desarollo';
console.log(`Buscando archivos .docx relacionados con estampillas en: ${searchDir}...`);
const found = findFiles(searchDir, /estampilla.*\.docx$/i);
console.log(`Encontrados ${found.length} archivos:`);
found.forEach(f => console.log(f));

const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const { exec } = require('child_process');
const { google } = require('googleapis');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Locate credentials file
const possibleCredPaths = [
    path.join(__dirname, '..', '..', 'credentials.json.json'),
    path.join(__dirname, '..', '..', 'credentials.json'),
    path.join(__dirname, '..', 'credentials.json')
];

let credPath = possibleCredPaths.find(p => fs.existsSync(p));
if (!credPath) {
    console.error('❌ No se encontró el archivo credentials.json ni credentials.json.json en el proyecto.');
    process.exit(1);
}

console.log('📄 Usando archivo de credenciales:', path.basename(credPath));
const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
const config = credentials.installed || credentials.web;

if (!config) {
    console.error('❌ El archivo de credenciales no tiene formato válido de cliente OAuth (installed o web).');
    process.exit(1);
}

const { client_id, client_secret } = config;
const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}`;

const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    REDIRECT_URI
);

const SCOPES = [
    'https://www.googleapis.com/auth/drive'
];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES
});

console.log('\n======================================================');
console.log('🔐 INICIANDO AUTORIZACIÓN CON TU GOOGLE DRIVE (5 TB)');
console.log('======================================================\n');
console.log('1. Abriendo tu navegador automáticamente para autorizar el acceso...');
console.log('2. Si el navegador no abre, copia y pega este enlace en tu navegador:\n');
console.log(authUrl);
console.log('\nEsperando autorización en el puerto ' + PORT + '...\n');

// Try to open browser automatically on Windows
exec(`start "" "${authUrl.replace(/&/g, '^&')}"`, (err) => {
    if (err) {
        console.log('ℹ️ Por favor abre el enlace manualmente en tu navegador.');
    }
});

const server = http.createServer(async (req, res) => {
    try {
        if (req.url.startsWith('/?code=') || req.url.includes('code=')) {
            const queryObject = url.parse(req.url, true).query;
            const code = queryObject.code;

            if (code) {
                console.log('🔄 Código de autorización recibido. Obteniendo tokens...');
                const { tokens } = await oauth2Client.getToken(code);
                oauth2Client.setCredentials(tokens);

                // Save token.json in backend directory
                const tokenPath = path.join(__dirname, '..', 'token.json');
                fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
                console.log('💾 Token guardado en:', tokenPath);

                // Also update backend/.env
                const envPath = path.join(__dirname, '..', '.env');
                let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
                
                const updateEnvVar = (key, val) => {
                    const regex = new RegExp(`^${key}=.*$`, 'm');
                    if (regex.test(envContent)) {
                        envContent = envContent.replace(regex, `${key}=${val}`);
                    } else {
                        envContent += `\n${key}=${val}`;
                    }
                };

                updateEnvVar('GOOGLE_DRIVE_CLIENT_ID', client_id);
                updateEnvVar('GOOGLE_DRIVE_CLIENT_SECRET', client_secret);
                if (tokens.refresh_token) {
                    updateEnvVar('GOOGLE_DRIVE_REFRESH_TOKEN', tokens.refresh_token);
                }

                fs.writeFileSync(envPath, envContent.trim() + '\n');
                console.log('✅ Variables de Google Drive actualizadas en backend/.env');

                // Test Google Drive connection and check quota
                const drive = google.drive({ version: 'v3', auth: oauth2Client });
                const aboutRes = await drive.about.get({ fields: 'user, storageQuota' });
                const user = aboutRes.data.user || {};
                const quota = aboutRes.data.storageQuota || {};

                const limitGB = quota.limit ? (Number(quota.limit) / (1024 ** 3)).toFixed(2) : 'Ilimitado';
                const usageGB = quota.usage ? (Number(quota.usage) / (1024 ** 3)).toFixed(2) : '0';

                console.log('\n🎉 ¡CONEXIÓN EXITOSA CON GOOGLE DRIVE!');
                console.log(`👤 Cuenta vinculada: ${user.displayName} (${user.emailAddress})`);
                console.log(`📊 Almacenamiento Total: ${limitGB} GB (~${(Number(limitGB)/1024).toFixed(1)} TB)`);
                console.log(`📈 Almacenamiento Usado: ${usageGB} GB\n`);

                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                        <h1 style="color: #10B981;">✅ ¡Conexión Exitosa con Google Drive!</h1>
                        <p style="font-size: 1.1rem; color: #374151;">
                            La aplicación <strong>AutoCuentas</strong> ya tiene acceso a tu Drive de <strong>${user.emailAddress}</strong>.
                        </p>
                        <p style="font-size: 1rem; color: #6B7280;">
                            Capacidad: <strong>${limitGB} GB</strong> | Usado: <strong>${usageGB} GB</strong>
                        </p>
                        <p style="margin-top: 30px; color: #9CA3AF;">Ya puedes cerrar esta pestaña del navegador y regresar a la terminal.</p>
                    </div>
                `);

                setTimeout(() => {
                    server.close();
                    process.exit(0);
                }, 2000);
            }
        }
    } catch (err) {
        console.error('❌ Error procesando autorización:', err.message);
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Error: ${err.message}</h1>`);
    }
});

server.listen(PORT, () => {
    console.log(`Servidor local listo en http://localhost:${PORT}`);
});

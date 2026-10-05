let webdavModule = null;
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

class NextcloudService {
    constructor() {
        this.client = null;
        this.baseUrl = (process.env.NEXTCLOUD_URL || '').trim().replace(/\/+$/, '');
        this.username = (process.env.NEXTCLOUD_USER || '').trim();
        this.password = (process.env.NEXTCLOUD_PASSWORD || '').trim();
        this.basePath = (process.env.NEXTCLOUD_BASE_PATH || '/').trim();
        this.isInitialized = false;
    }

    /**
     * Devuelve la URL WebDAV completa para el usuario
     */
    getWebdavUrl() {
        if (!this.baseUrl || !this.username) return null;
        if (this.baseUrl.includes('/remote.php/')) {
            return this.baseUrl;
        }
        return `${this.baseUrl}/remote.php/dav/files/${encodeURIComponent(this.username)}`;
    }

    /**
     * Inicializa el cliente WebDAV usando importación dinámica (compatible con ESM)
     */
    async init() {
        if (this.isInitialized && this.client) return this.client;

        // Recargar variables en caso de cambio dinámico
        this.baseUrl = (process.env.NEXTCLOUD_URL || '').trim().replace(/\/+$/, '');
        this.username = (process.env.NEXTCLOUD_USER || '').trim();
        this.password = (process.env.NEXTCLOUD_PASSWORD || '').trim();
        this.basePath = (process.env.NEXTCLOUD_BASE_PATH || '/').trim();

        const webdavUrl = this.getWebdavUrl();
        if (!webdavUrl || !this.password) {
            console.warn('⚠️ Nextcloud: Faltan NEXTCLOUD_URL, NEXTCLOUD_USER o NEXTCLOUD_PASSWORD en .env.');
            return null;
        }

        try {
            if (!webdavModule) {
                webdavModule = await import('webdav');
            }
            const { createClient } = webdavModule;
            this.client = createClient(webdavUrl, {
                username: this.username,
                password: this.password
            });
            this.isInitialized = true;
            return this.client;
        } catch (error) {
            console.error('❌ Error al inicializar cliente WebDAV de Nextcloud:', error.message);
            return null;
        }
    }

    /**
     * Normaliza rutas relativas/absolutas a formato WebDAV (/carpeta/subcarpeta)
     */
    normalizePath(targetPath) {
        let clean = (targetPath || '').replace(/\\/g, '/').replace(/\/+/g, '/');
        if (!clean.startsWith('/')) clean = '/' + clean;
        return clean.replace(/\/+$/, '');
    }

    /**
     * Construye la ruta completa para la cuenta del contratista
     */
    buildAccountPath({ basePath, contractorName, contractNumber, accountNumber }) {
        const root = basePath || this.basePath || '/';
        const accountFolderName = typeof accountNumber === 'number' || /^\d+$/.test(accountNumber)
            ? `CUENTA ${accountNumber}`
            : (accountNumber.startsWith('CUENTA') ? accountNumber : `CUENTA ${accountNumber}`);

        return this.normalizePath(path.posix.join(root, contractorName, contractNumber, accountFolderName));
    }

    /**
     * Prueba la conexión a WebDAV listando el directorio base
     */
    async testConnection(targetPath) {
        const client = await this.init();
        if (!client) {
            return { success: false, message: 'Cliente WebDAV no configurado en .env' };
        }

        const pathToTest = this.normalizePath(targetPath || this.basePath || '/');
        try {
            const contents = await client.getDirectoryContents(pathToTest);
            const items = Array.isArray(contents) ? contents : (contents.data || []);
            return {
                success: true,
                message: 'Conexión WebDAV exitosa',
                totalItems: items.length,
                basePath: pathToTest,
                sampleItems: items.slice(0, 10).map(i => ({ filename: i.filename, type: i.type, size: i.size }))
            };
        } catch (error) {
            return {
                success: false,
                message: `Fallo de conexión WebDAV en ${pathToTest}: ${error.message}`,
                error
            };
        }
    }

    /**
     * Asegura la creación recursiva de directorios
     */
    async ensureDirectory(targetPath) {
        const client = await this.init();
        if (!client) throw new Error('Cliente Nextcloud no inicializado');

        const normalized = this.normalizePath(targetPath);
        const parts = normalized.split('/').filter(Boolean);
        let current = '';

        for (const part of parts) {
            current += '/' + part;
            try {
                const exists = await client.exists(current);
                if (!exists) {
                    await client.createDirectory(current);
                }
            } catch (err) {
                if (err.status !== 405 && !err.message.includes('already exists')) {
                    console.warn(`Aviso al crear directorio ${current}: ${err.message}`);
                }
            }
        }
        return normalized;
    }

    /**
     * Crea la estructura estándar de carpetas para una cuenta:
     * - [Ruta Cuenta] / DOCUMENTOS
     * - [Ruta Cuenta] / EVIDENCIAS
     * - [Ruta Cuenta] / EVIDENCIAS / [Obligacion 1]
     * - [Ruta Cuenta] / EVIDENCIAS / [Obligacion 2] ...
     */
    async createAccountStructure({ basePath, contractorName, contractNumber, accountNumber, obligations = [] }) {
        const accountPath = this.buildAccountPath({ basePath, contractorName, contractNumber, accountNumber });
        const docsPath = `${accountPath}/DOCUMENTOS`;
        const evidencesPath = `${accountPath}/EVIDENCIAS`;

        console.log(`📁 Creando estructura en Nextcloud para: ${accountPath}`);
        await this.ensureDirectory(docsPath);
        await this.ensureDirectory(evidencesPath);

        const createdObligations = [];
        for (const obligation of obligations) {
            const cleanObligation = String(obligation).trim();
            if (cleanObligation) {
                const obligationPath = `${evidencesPath}/${cleanObligation}`;
                await this.ensureDirectory(obligationPath);
                createdObligations.push(obligationPath);
            }
        }

        return {
            success: true,
            accountPath,
            docsPath,
            evidencesPath,
            obligationsPaths: createdObligations
        };
    }

    /**
     * Sube un buffer a Nextcloud
     */
    async uploadBuffer(remoteFilePath, buffer, options = {}) {
        const client = await this.init();
        if (!client) throw new Error('Cliente Nextcloud no inicializado');

        const normalized = this.normalizePath(remoteFilePath);
        const parentDir = path.posix.dirname(normalized);
        await this.ensureDirectory(parentDir);

        await client.putFileContents(normalized, buffer, {
            overwrite: options.overwrite !== false
        });

        return {
            success: true,
            remotePath: normalized
        };
    }

    /**
     * Sube un archivo local de disco a Nextcloud
     */
    async uploadLocalFile(remoteFilePath, localFilePath, options = {}) {
        if (!fs.existsSync(localFilePath)) {
            throw new Error(`Archivo local no encontrado: ${localFilePath}`);
        }
        const fileBuffer = fs.readFileSync(localFilePath);
        return this.uploadBuffer(remoteFilePath, fileBuffer, options);
    }

    /**
     * Toma una captura de pantalla de la carpeta en Nextcloud usando Puppeteer
     */
    async captureFolderScreenshot({ folderPath, outputPath, viewport = { width: 1366, height: 768 } }) {
        if (!this.baseUrl || !this.username || !this.password) {
            throw new Error('Credenciales de Nextcloud incompletas para la captura web');
        }

        const normalizedPath = this.normalizePath(folderPath);
        const filesUrl = `${this.baseUrl}/apps/files/?dir=${encodeURIComponent(normalizedPath)}`;
        const loginUrl = `${this.baseUrl}/login`;

        const launchArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process'
        ];

        const launchOptions = {
            headless: 'new',
            args: launchArgs,
            defaultViewport: viewport
        };

        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }

        let browser = null;
        try {
            browser = await puppeteer.launch(launchOptions);
            const page = await browser.newPage();
            await page.setViewport(viewport);

            // 1. Navegar a Login
            try {
                await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            } catch (_) {
                await page.goto(`${this.baseUrl}/index.php/login`, { waitUntil: 'networkidle2', timeout: 30000 });
            }

            // Comprobar si pide login
            const hasUserField = await page.$('#user');
            if (hasUserField) {
                await page.type('#user', this.username);
                await page.type('#password', this.password);
                
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
                    page.keyboard.press('Enter')
                ]);
            }

            // 2. Navegar directamente a la carpeta solicitada
            await page.goto(filesUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            // 3. Esperar que la lista de archivos o la barra de ruta cargue
            try {
                await page.waitForSelector('#fileList, .files-list, table.files-filestable, #app-content-files, [data-cy-files-list], .app-content', {
                    visible: true,
                    timeout: 15000
                });
            } catch (_) {}

            // Esperar un respiro para asegurar renderizado visual de nombres e iconos
            await new Promise((r) => setTimeout(r, 2000));

            // Asegurar que el directorio de salida existe
            const outDir = path.dirname(outputPath);
            if (!fs.existsSync(outDir)) {
                fs.mkdirSync(outDir, { recursive: true });
            }

            // 4. Tomar la captura de pantalla
            await page.screenshot({
                path: outputPath,
                fullPage: false
            });

            return {
                success: true,
                screenshotPath: outputPath,
                folderPath: normalizedPath
            };
        } catch (error) {
            console.error(`❌ Error al capturar pantalla de Nextcloud en ${normalizedPath}:`, error.message);
            throw error;
        } finally {
            if (browser) {
                await browser.close().catch(() => {});
            }
        }
    }

    /**
     * Captura en lote múltiples carpetas reutilizando una sola sesión de navegador (mucho más rápido y eficiente en RAM)
     * @param {Array<{ folderPath: string, outputPath: string }>} items
     * @param {Object} [options]
     */
    async captureMultipleFoldersScreenshots(items, options = {}) {
        if (!items || items.length === 0) return [];
        if (!this.baseUrl || !this.username || !this.password) {
            throw new Error('Credenciales de Nextcloud incompletas para la captura web');
        }

        const viewport = options.viewport || { width: 1600, height: 900 };
        const launchArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process'
        ];

        const launchOptions = {
            headless: 'new',
            args: launchArgs,
            defaultViewport: viewport
        };

        if (process.env.PUPPETEER_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        }

        let browser = null;
        const results = [];

        try {
            browser = await puppeteer.launch(launchOptions);
            const page = await browser.newPage();
            await page.setViewport(viewport);

            // 1. Iniciar sesión una sola vez
            const loginUrl = `${this.baseUrl}/login`;
            try {
                await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            } catch (_) {
                await page.goto(`${this.baseUrl}/index.php/login`, { waitUntil: 'networkidle2', timeout: 30000 });
            }

            const hasUserField = await page.$('#user');
            if (hasUserField) {
                await page.type('#user', this.username);
                await page.type('#password', this.password);
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
                    page.keyboard.press('Enter')
                ]);
            }

            // 2. Iterar por cada carpeta de obligación
            for (const item of items) {
                const normalizedPath = this.normalizePath(item.folderPath);
                const filesUrl = `${this.baseUrl}/apps/files/?dir=${encodeURIComponent(normalizedPath)}`;

                try {
                    await page.goto(filesUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                    try {
                        await page.waitForSelector('#fileList, .files-list, table.files-filestable, #app-content-files, [data-cy-files-list], .app-content', {
                            visible: true,
                            timeout: 15000
                        });
                    } catch (_) {}

                    await new Promise((r) => setTimeout(r, 2000));

                    const outDir = path.dirname(item.outputPath);
                    if (!fs.existsSync(outDir)) {
                        fs.mkdirSync(outDir, { recursive: true });
                    }

                    await page.screenshot({ path: item.outputPath, fullPage: false });
                    results.push({ cleanCode: item.cleanCode, success: true, folderPath: normalizedPath, outputPath: item.outputPath });
                } catch (folderErr) {
                    console.warn(`⚠️ Error al capturar carpeta ${normalizedPath}:`, folderErr.message);
                    results.push({ cleanCode: item.cleanCode, success: false, folderPath: normalizedPath, error: folderErr.message });
                }
            }

            return results;
        } finally {
            if (browser) {
                await browser.close().catch(() => {});
            }
        }
    }

    /**
     * Sube documentos generados finales a la carpeta DOCUMENTOS en Nextcloud
     */
    async uploadFinalDocumentsToNextcloud({ basePath, contractorName, contractNumber, accountNumber, documents }) {
        const accountPath = this.buildAccountPath({ basePath, contractorName, contractNumber, accountNumber });
        const docsPath = `${accountPath}/DOCUMENTOS`;
        await this.ensureDirectory(docsPath);

        const uploaded = [];
        for (const doc of documents) {
            try {
                if (doc.localPath && fs.existsSync(doc.localPath)) {
                    const destRemote = `${docsPath}/${doc.destFileName || path.basename(doc.localPath)}`;
                    await this.uploadLocalFile(destRemote, doc.localPath);
                    uploaded.push(destRemote);
                } else if (doc.buffer) {
                    const destRemote = `${docsPath}/${doc.destFileName}`;
                    await this.uploadBuffer(destRemote, doc.buffer);
                    uploaded.push(destRemote);
                }
            } catch (err) {
                console.warn(`⚠️ Error al subir documento a Nextcloud (${doc.destFileName}):`, err.message);
            }
        }
        return { success: true, docsPath, uploaded };
    }
}

module.exports = new NextcloudService();


/**
 * Diccionario de Secretarías y Dependencias de la Entidad (Alcaldía de Armenia) - Backend
 */

const DEFAULT_SECRETARIAS = [
    {
        id: 'sec_tic',
        codigo: '11401',
        nombreOficial: 'Secretaría de las Tecnologías de la Información y las Comunicaciones',
        nombreFormato: 'SECRETARIA TIC - 11401',
        nombreCorto: 'SECRETARIA TIC',
        sigla: 'TIC',
        supervisorDefault: 'ANDRES FELIPE BARRERA PEREZ',
        aliases: ['tic', 'tecnologias', 'tecnología', 'comunicaciones', 'sistemas', 'infraestructura tic', 'mesa de ayuda', '11401', 'seritaria tic', 'secretaria tic']
    },
    {
        id: 'sec_hacienda',
        codigo: '11201',
        nombreOficial: 'Secretaría de Hacienda',
        nombreFormato: 'SECRETARIA DE HACIENDA - 11201',
        nombreCorto: 'SECRETARIA DE HACIENDA',
        sigla: 'SH',
        supervisorDefault: '',
        aliases: ['hacienda', 'tesoreria', 'presupuesto', 'contabilidad', 'rentas', '11201']
    },
    {
        id: 'sec_planeacion',
        codigo: '11301',
        nombreOficial: 'Departamento Administrativo de Planeación',
        nombreFormato: 'DEPARTAMENTO ADMINISTRATIVO DE PLANEACION - 11301',
        nombreCorto: 'PLANEACION',
        sigla: 'DAP',
        supervisorDefault: '',
        aliases: ['planeacion', 'planeación', 'dap', 'ordenamiento', '11301']
    },
    {
        id: 'sec_educacion',
        codigo: '11501',
        nombreOficial: 'Secretaría de Educación',
        nombreFormato: 'SECRETARIA DE EDUCACION - 11501',
        nombreCorto: 'SECRETARIA DE EDUCACION',
        sigla: 'SEM',
        supervisorDefault: '',
        aliases: ['educacion', 'educación', 'sem', 'colegios', '11501']
    },
    {
        id: 'sec_salud',
        codigo: '11601',
        nombreOficial: 'Secretaría de Salud',
        nombreFormato: 'SECRETARIA DE SALUD - 11601',
        nombreCorto: 'SECRETARIA DE SALUD',
        sigla: 'SSM',
        supervisorDefault: '',
        aliases: ['salud', 'ssm', 'epidemiologia', '11601']
    },
    {
        id: 'sec_gobierno',
        codigo: '11101',
        nombreOficial: 'Secretaría de Gobierno y Convivencia',
        nombreFormato: 'SECRETARIA DE GOBIERNO - 11101',
        nombreCorto: 'SECRETARIA DE GOBIERNO',
        sigla: 'SGC',
        supervisorDefault: '',
        aliases: ['gobierno', 'convivencia', 'sgc', 'espacio publico', '11101']
    },
    {
        id: 'sec_infraestructura',
        codigo: '11701',
        nombreOficial: 'Secretaría de Infraestructura',
        nombreFormato: 'SECRETARIA DE INFRAESTRUCTURA - 11701',
        nombreCorto: 'SECRETARIA DE INFRAESTRUCTURA',
        sigla: 'SI',
        supervisorDefault: '',
        aliases: ['infraestructura', 'obras', 'si', 'vias', '11701']
    },
    {
        id: 'sec_setta',
        codigo: '11801',
        nombreOficial: 'Secretaría de Tránsito y Transporte de Armenia (SETTA)',
        nombreFormato: 'SETTA - 11801',
        nombreCorto: 'SETTA',
        sigla: 'SETTA',
        supervisorDefault: '',
        aliases: ['setta', 'transito', 'tránsito', 'movilidad', '11801']
    },
    {
        id: 'sec_dafi',
        codigo: '11901',
        nombreOficial: 'Departamento Administrativo de Fortalecimiento Institucional',
        nombreFormato: 'DAFI - 11901',
        nombreCorto: 'DAFI',
        sigla: 'DAFI',
        supervisorDefault: '',
        aliases: ['dafi', 'fortalecimiento', 'talento humano', 'personal', '11901']
    }
];

function normalizeStr(str = '') {
    return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function resolveSecretaria(query = '') {
    if (!query) return null;
    const cleanQuery = normalizeStr(query);

    // 1. Match by code (e.g. "11401")
    const byCode = DEFAULT_SECRETARIAS.find(s => s.codigo && cleanQuery.includes(normalizeStr(s.codigo)));
    if (byCode) return byCode;

    // 2. Match by sigla
    const bySigla = DEFAULT_SECRETARIAS.find(s => {
        const siglaNorm = normalizeStr(s.sigla);
        const regex = new RegExp(`\\b${siglaNorm}\\b`, 'i');
        return regex.test(cleanQuery);
    });
    if (bySigla) return bySigla;

    // 3. Match by name
    const byName = DEFAULT_SECRETARIAS.find(s => {
        const ofi = normalizeStr(s.nombreOficial);
        const fmt = normalizeStr(s.nombreFormato);
        const cor = normalizeStr(s.nombreCorto);
        return ofi.includes(cleanQuery) || fmt.includes(cleanQuery) || cor.includes(cleanQuery) ||
               cleanQuery.includes(ofi) || cleanQuery.includes(fmt) || cleanQuery.includes(cor);
    });
    if (byName) return byName;

    // 4. Match by aliases
    const byAlias = DEFAULT_SECRETARIAS.find(s => {
        if (!s.aliases || !Array.isArray(s.aliases)) return false;
        return s.aliases.some(alias => cleanQuery.includes(normalizeStr(alias)));
    });
    if (byAlias) return byAlias;

    return null;
}

/**
 * Formatea la dependencia según la regla de negocio:
 * Combina la Unidad de Contratación (o Dependencia) con la Unidad Ejecutora del RP.
 * Si en el RP viene invertido como "11401 - SECRETARIA TIC" o "11401 - SERITARIA TIC",
 * lo normaliza al orden reglamentario: "SECRETARIA TIC - 11401".
 *
 * @param {string} nameOrQuery - Nombre de la dependencia o unidad de contratación (ej: "SECRETARIA TIC", "11401 - SECRETARIA TIC")
 * @param {string} [code=''] - Código de la unidad ejecutora (ej: "11401")
 * @returns {string} Texto formateado (ej: "SECRETARIA TIC - 11401")
 */
function formatDependenciaWithCode(nameOrQuery = '', code = '') {
    if (!nameOrQuery && !code) return 'SECRETARIA DE PLANEACION';
    let raw = String(nameOrQuery || '').trim();
    let cod = String(code || '').trim();

    // 1. Detectar si viene invertido desde el RP: "11401 - SECRETARIA TIC" o "11401 - SERITARIA TIC"
    const invertedMatch = raw.match(/^(\d{4,6})\s*[-–]\s*(.+)$/i);
    if (invertedMatch) {
        cod = cod || invertedMatch[1].trim();
        raw = invertedMatch[2].trim();
    }

    // 2. Detectar si ya trae el código al final: "SECRETARIA TIC - 11401"
    const standardMatch = raw.match(/^(.+?)\s*[-–]\s*(\d{4,6})$/i);
    if (standardMatch) {
        raw = standardMatch[1].trim();
        cod = cod || standardMatch[2].trim();
    }

    // 3. Resolver con el diccionario de secretarías para estandarizar el nombre y código oficial
    const sec = resolveSecretaria(raw || cod);
    if (sec) {
        cod = cod || sec.codigo;
        // Para la Secretaría TIC, la regla solicitada por el usuario es "SECRETARIA TIC - 11401"
        if (sec.id === 'sec_tic') {
            return cod ? `SECRETARIA TIC - ${cod}` : 'SECRETARIA TIC - 11401';
        }
        return cod ? `${sec.nombreCorto} - ${cod}` : sec.nombreFormato;
    }

    // 4. Si no está en el catálogo, limpiar a mayúsculas y acoplar el código si existe
    const cleanName = raw.toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Sin tildes en mayúscula como en los formatos de entidad
    return cod ? `${cleanName} - ${cod}` : cleanName;
}

function getFormatNameForDependency(query = '', fallback = 'SECRETARIA DE PLANEACION', code = '') {
    if (!query && !code) return fallback;
    return formatDependenciaWithCode(query, code);
}

module.exports = {
    DEFAULT_SECRETARIAS,
    resolveSecretaria,
    formatDependenciaWithCode,
    getFormatNameForDependency
};

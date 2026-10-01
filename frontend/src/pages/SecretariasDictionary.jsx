import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Building2, 
    FileText, 
    Plus, 
    Edit3, 
    Trash2, 
    RotateCcw, 
    ArrowLeft, 
    Copy, 
    Check, 
    Search, 
    Sparkles, 
    Layers, 
    Users, 
    ShieldCheck, 
    X, 
    Info,
    Tag,
    Hash,
    CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
    getSecretarias, 
    saveSecretaria, 
    deleteSecretaria, 
    resetSecretariasToDefaults,
    resolveSecretaria,
    formatDependenciaWithCode
} from '../utils/secretariasDictionary';

export default function SecretariasDictionary() {
    const navigate = useNavigate();
    const [secretarias, setSecretarias] = useState(() => getSecretarias());
    const [search, setSearch] = useState('');
    const [copiedFormat, setCopiedFormat] = useState(false);

    // Interactive Tester State
    const [testQuery, setTestQuery] = useState('11401 - SERITARIA TIC');
    const [testCode, setTestCode] = useState('11401');

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [editingSec, setEditingSec] = useState(null);
    const [formData, setFormData] = useState({
        codigo: '',
        nombreOficial: '',
        nombreFormato: '',
        nombreCorto: '',
        sigla: '',
        supervisorDefault: '',
        aliases: []
    });
    const [newAliasInput, setNewAliasInput] = useState('');

    // Tester Resolution
    const resolvedTest = useMemo(() => {
        const sec = resolveSecretaria(testQuery || testCode);
        const formatted = formatDependenciaWithCode(testQuery, testCode);
        return {
            sec,
            formatted
        };
    }, [testQuery, testCode, secretarias]);

    const filteredSecretarias = useMemo(() => {
        if (!search.trim()) return secretarias;
        const q = search.toLowerCase();
        return secretarias.filter(s => 
            s.nombreOficial?.toLowerCase().includes(q) ||
            s.nombreFormato?.toLowerCase().includes(q) ||
            s.nombreCorto?.toLowerCase().includes(q) ||
            s.sigla?.toLowerCase().includes(q) ||
            s.codigo?.toLowerCase().includes(q) ||
            (s.aliases && s.aliases.some(a => a.toLowerCase().includes(q)))
        );
    }, [secretarias, search]);

    const handleOpenModal = (sec = null) => {
        if (sec) {
            setEditingSec(sec);
            setFormData({
                id: sec.id,
                codigo: sec.codigo || '',
                nombreOficial: sec.nombreOficial || '',
                nombreFormato: sec.nombreFormato || '',
                nombreCorto: sec.nombreCorto || '',
                sigla: sec.sigla || '',
                supervisorDefault: sec.supervisorDefault || '',
                aliases: [...(sec.aliases || [])]
            });
        } else {
            setEditingSec(null);
            setFormData({
                codigo: '',
                nombreOficial: '',
                nombreFormato: '',
                nombreCorto: '',
                sigla: '',
                supervisorDefault: '',
                aliases: []
            });
        }
        setNewAliasInput('');
        setModalOpen(true);
    };

    const handleSaveModal = (e) => {
        e.preventDefault();
        if (!formData.nombreOficial || !formData.nombreFormato) {
            alert('Por favor completa el Nombre Oficial y el Nombre para Formatos Word');
            return;
        }

        const toSave = {
            ...formData,
            id: editingSec ? editingSec.id : `sec_${Date.now()}`
        };

        const updated = saveSecretaria(toSave);
        setSecretarias(updated);
        setModalOpen(false);
    };

    const handleDelete = (id) => {
        if (window.confirm('¿Seguro que deseas eliminar esta dependencia del diccionario?')) {
            const updated = deleteSecretaria(id);
            setSecretarias(updated);
        }
    };

    const handleReset = () => {
        if (window.confirm('¿Restablecer todo el diccionario de Secretarías a los valores de fábrica? Se conservará la configuración inicial de la Alcaldía de Armenia.')) {
            const defaults = resetSecretariasToDefaults();
            setSecretarias(defaults);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopiedFormat(true);
        setTimeout(() => setCopiedFormat(false), 2000);
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--text-main)', paddingBottom: '4rem' }}>
            {/* Header */}
            <div style={{
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
                padding: '1.25rem 2rem',
                position: 'sticky',
                top: 0,
                zIndex: 40
            }}>
                <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button 
                            onClick={() => navigate('/dashboard')}
                            className="btn"
                            style={{ 
                                background: 'rgba(255,255,255,0.05)', 
                                border: '1px solid var(--border)', 
                                padding: '0.5rem 0.75rem',
                                color: 'var(--text-main)' 
                            }}
                        >
                            <ArrowLeft size={16} />
                            <span style={{ marginLeft: '0.4rem' }}>Panel</span>
                        </button>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <h1 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>
                                    Diccionario de Dependencias & Secretarías
                                </h1>
                                <span style={{
                                    background: 'rgba(37, 99, 235, 0.1)',
                                    color: 'var(--primary)',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '999px'
                                }}>
                                    Alcaldía de Armenia
                                </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Equivalencia entre nombres oficiales de minuta y nombres reglamentarios para formatos Word (<code>{'{{dependencia}}'}</code>).
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button
                            onClick={handleReset}
                            className="btn"
                            title="Restaurar valores de fábrica"
                            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                        >
                            <RotateCcw size={16} style={{ marginRight: '0.4rem' }} />
                            <span>Restablecer</span>
                        </button>
                        <button
                            onClick={() => handleOpenModal()}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                            <Plus size={16} />
                            <span>Nueva Dependencia</span>
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '1400px', margin: '2rem auto', padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* ───────────────────────────────────────────────────────────── */}
                {/* PROBADOR EN VIVO DE NORMALIZACIÓN Y FORMATO WORD */}
                {/* ───────────────────────────────────────────────────────────── */}
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(99, 102, 241, 0.05))',
                        border: '1px solid rgba(37, 99, 235, 0.25)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '1.5rem',
                        boxShadow: 'var(--shadow)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{
                                background: 'var(--primary)',
                                color: 'white',
                                padding: '0.4rem',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <Sparkles size={18} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                                    Probador en Vivo: Normalización de Dependencia para Formatos Word
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Ingresa cualquier texto extraído de la Minuta, RP o Acta de Inicio para comprobar cómo se estampará en los documentos.
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '0.25rem' }}>Ejemplos:</span>
                            <button
                                type="button"
                                className="btn"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)' }}
                                onClick={() => { setTestQuery('11401 - SERITARIA TIC'); setTestCode('11401'); }}
                            >
                                11401 - SERITARIA TIC
                            </button>
                            <button
                                type="button"
                                className="btn"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)' }}
                                onClick={() => { setTestQuery('SECRETARIA TIC'); setTestCode('11401'); }}
                            >
                                SECRETARIA TIC
                            </button>
                            <button
                                type="button"
                                className="btn"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)' }}
                                onClick={() => { setTestQuery('Secretaría de Hacienda'); setTestCode('11201'); }}
                            >
                                Hacienda
                            </button>
                            <button
                                type="button"
                                className="btn"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)' }}
                                onClick={() => { setTestQuery('Planeación'); setTestCode('11301'); }}
                            >
                                Planeación
                            </button>
                        </div>
                    </div>

                    {/* Inputs Tester */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div>
                            <label className="label" style={{ fontSize: '0.8rem' }}>Texto en Documento / Acta / Minuta (Query)</label>
                            <input 
                                className="input" 
                                value={testQuery} 
                                onChange={(e) => setTestQuery(e.target.value)} 
                                placeholder="Ej: 11401 - SERITARIA TIC, SECRETARIA TIC..." 
                            />
                        </div>

                        <div>
                            <label className="label" style={{ fontSize: '0.8rem' }}>Código Unidad Ejecutora en RP (Opcional)</label>
                            <input 
                                className="input" 
                                value={testCode} 
                                onChange={(e) => setTestCode(e.target.value)} 
                                placeholder="Ej: 11401" 
                            />
                        </div>
                    </div>

                    {/* Results Display */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                        {/* Result 1: Word Formatted Output */}
                        <div style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: 'var(--shadow-sm)'
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <FileText size={16} color="var(--primary)" />
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                            Resultado Formatos Word ({'{{dependencia}}'})
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(resolvedTest.formatted)}
                                        className="btn"
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}
                                        title="Copiar texto formateado"
                                    >
                                        {copiedFormat ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                                        <span style={{ marginLeft: '0.3rem' }}>{copiedFormat ? 'Copiado' : 'Copiar'}</span>
                                    </button>
                                </div>
                                <div style={{
                                    fontFamily: 'monospace',
                                    fontSize: '1.2rem',
                                    fontWeight: 700,
                                    color: 'var(--primary)',
                                    background: 'rgba(37, 99, 235, 0.06)',
                                    padding: '0.6rem 0.8rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px dashed rgba(37, 99, 235, 0.3)',
                                    marginBottom: '0.5rem'
                                }}>
                                    {resolvedTest.formatted}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Inyectado en los certificados de supervisión, informes y cuentas de cobro para cumplir la directriz de la Entidad.
                                </div>
                            </div>
                        </div>

                        {/* Result 2: Matched Catalog Entity */}
                        <div style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: 'var(--shadow-sm)'
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <Building2 size={16} color="var(--success)" />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                        Dependencia Identificada en Catálogo
                                    </span>
                                </div>
                                {resolvedTest.sec ? (
                                    <>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                                            {resolvedTest.sec.nombreOficial}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                                            <span style={{ fontSize: '0.75rem', background: 'rgba(37,99,235,0.1)', color: 'var(--primary)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                                                Sigla: {resolvedTest.sec.sigla}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.06)', color: 'var(--text-main)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontFamily: 'monospace' }}>
                                                Código: {resolvedTest.sec.codigo}
                                            </span>
                                            {resolvedTest.sec.supervisorDefault && (
                                                <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                                                    Sup: {resolvedTest.sec.supervisorDefault}
                                                </span>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                        No se encontró coincidencia directa en el catálogo. Se aplicará normalización en mayúsculas estándar.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ───────────────────────────────────────────────────────────── */}
                {/* CATÁLOGO DE SECRETARÍAS REGISTRADAS */}
                {/* ───────────────────────────────────────────────────────────── */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                                Dependencias Registradas ({filteredSecretarias.length})
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Equivalencias de nombres, códigos presupuestales y alias de reconocimiento.
                            </p>
                        </div>

                        {/* Search Bar */}
                        <div style={{ position: 'relative', width: '320px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input 
                                className="input" 
                                style={{ paddingLeft: '2.25rem' }} 
                                placeholder="Buscar por nombre, sigla o código..." 
                                value={search} 
                                onChange={(e) => setSearch(e.target.value)} 
                            />
                        </div>
                    </div>

                    {/* Grid of Secretarías */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.25rem' }}>
                        {filteredSecretarias.map((sec) => (
                            <motion.div
                                key={sec.id}
                                layout
                                style={{
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '1.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    boxShadow: 'var(--shadow)',
                                    position: 'relative'
                                }}
                            >
                                <div>
                                    {/* Top badges */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                            <span style={{
                                                background: 'rgba(37, 99, 235, 0.1)',
                                                color: 'var(--primary)',
                                                fontWeight: 700,
                                                fontSize: '0.75rem',
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '4px'
                                            }}>
                                                {sec.sigla || 'SEC'}
                                            </span>
                                            {sec.codigo && (
                                                <span style={{
                                                    background: 'rgba(0,0,0,0.06)',
                                                    color: 'var(--text-muted)',
                                                    fontSize: '0.75rem',
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '4px',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    Cód: {sec.codigo}
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                                            <button
                                                onClick={() => {
                                                    setTestQuery(sec.nombreCorto || sec.nombreOficial);
                                                    setTestCode(sec.codigo || '');
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                className="btn"
                                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}
                                                title="Probar en el normalizador"
                                            >
                                                <Sparkles size={13} color="var(--primary)" />
                                                <span style={{ marginLeft: '0.3rem' }}>Probar</span>
                                            </button>
                                            <button
                                                onClick={() => handleOpenModal(sec)}
                                                className="btn"
                                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}
                                                title="Editar"
                                            >
                                                <Edit3 size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(sec.id)}
                                                className="btn"
                                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}
                                                title="Eliminar"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Nombre Oficial */}
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-main)', lineHeight: 1.3 }}>
                                        {sec.nombreOficial}
                                    </h3>

                                    {/* Nombre para Formatos Word */}
                                    <div style={{
                                        background: 'rgba(37, 99, 235, 0.05)',
                                        border: '1px dashed rgba(37, 99, 235, 0.3)',
                                        borderRadius: 'var(--radius-sm)',
                                        padding: '0.6rem 0.75rem',
                                        marginBottom: '0.75rem'
                                    }}>
                                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.15rem' }}>
                                            📄 Nombre Usado en los Formatos Word
                                        </div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                                            {sec.nombreFormato}
                                        </div>
                                    </div>

                                    {/* Aliases / Palabras Clave */}
                                    {sec.aliases && sec.aliases.length > 0 && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                                                Alias de detección automática ({sec.aliases.length}):
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                {sec.aliases.map((alias, i) => (
                                                    <span 
                                                        key={i}
                                                        style={{
                                                            fontSize: '0.68rem',
                                                            background: 'rgba(0,0,0,0.04)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: '3px',
                                                            padding: '0.1rem 0.35rem',
                                                            color: 'var(--text-muted)'
                                                        }}
                                                    >
                                                        {alias}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {sec.supervisorDefault && (
                                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        <strong>Supervisor por defecto:</strong> {sec.supervisorDefault}
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ───────────────────────────────────────────────────────────── */}
            {/* MODAL CREAR / EDITAR SECRETARÍA */}
            {/* ───────────────────────────────────────────────────────────── */}
            <AnimatePresence>
                {modalOpen && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 100,
                        padding: '1.5rem',
                        backdropFilter: 'blur(4px)'
                    }}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-lg)',
                                maxWidth: '650px',
                                width: '100%',
                                maxHeight: '90vh',
                                overflowY: 'auto',
                                boxShadow: 'var(--shadow-lg)',
                                padding: '1.75rem'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Building2 size={20} color="var(--primary)" />
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                                        {editingSec ? 'Editar Dependencia / Secretaría' : 'Nueva Dependencia / Secretaría'}
                                    </h3>
                                </div>
                                <button 
                                    onClick={() => setModalOpen(false)}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveModal}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="label">Nombre Oficial en Contrato / Minuta *</label>
                                        <input 
                                            className="input" 
                                            required
                                            value={formData.nombreOficial} 
                                            onChange={(e) => setFormData({ ...formData, nombreOficial: e.target.value })}
                                            placeholder="Ej: Secretaría de las Tecnologías de la Información y las Comunicaciones"
                                        />
                                    </div>

                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="label" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                                            Nombre Exacto para Formatos Word ({'{{dependencia}}'}) *
                                        </label>
                                        <input 
                                            className="input" 
                                            required
                                            style={{ borderColor: 'var(--primary)', background: 'rgba(37, 99, 235, 0.03)' }}
                                            value={formData.nombreFormato} 
                                            onChange={(e) => setFormData({ ...formData, nombreFormato: e.target.value })}
                                            placeholder="Ej: SECRETARIA TIC - 11401"
                                        />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                                            Texto que se estampará en el Certificado del Supervisor, Informes de Actividades y Cuentas de Cobro.
                                        </span>
                                    </div>

                                    <div className="form-group">
                                        <label className="label">Nombre Corto / Unidad</label>
                                        <input 
                                            className="input" 
                                            value={formData.nombreCorto} 
                                            onChange={(e) => setFormData({ ...formData, nombreCorto: e.target.value })}
                                            placeholder="Ej: SECRETARIA TIC"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="label">Código Presupuestal</label>
                                        <input 
                                            className="input" 
                                            value={formData.codigo} 
                                            onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                                            placeholder="Ej: 11401"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="label">Sigla o Abreviatura</label>
                                        <input 
                                            className="input" 
                                            value={formData.sigla} 
                                            onChange={(e) => setFormData({ ...formData, sigla: e.target.value.toUpperCase() })}
                                            placeholder="Ej: TIC"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="label">Supervisor por Defecto (Opcional)</label>
                                        <input 
                                            className="input" 
                                            value={formData.supervisorDefault} 
                                            onChange={(e) => setFormData({ ...formData, supervisorDefault: e.target.value })}
                                            placeholder="Ej: ANDRES FELIPE BARRERA PEREZ"
                                        />
                                    </div>

                                    {/* Alias / Palabras Clave */}
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <label className="label">Alias y Palabras Clave para Detección Automática</label>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <input 
                                                className="input" 
                                                value={newAliasInput} 
                                                onChange={(e) => setNewAliasInput(e.target.value)}
                                                placeholder="Ej: sistemas, tic, mesa de ayuda, seritaria tic..."
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (newAliasInput.trim()) {
                                                            setFormData({ ...formData, aliases: [...formData.aliases, newAliasInput.trim().toLowerCase()] });
                                                            setNewAliasInput('');
                                                        }
                                                    }
                                                }}
                                            />
                                            <button 
                                                type="button" 
                                                className="btn btn-primary"
                                                onClick={() => {
                                                    if (newAliasInput.trim()) {
                                                        setFormData({ ...formData, aliases: [...formData.aliases, newAliasInput.trim().toLowerCase()] });
                                                        setNewAliasInput('');
                                                    }
                                                }}
                                            >
                                                Agregar
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            {formData.aliases.map((al, i) => (
                                                <span 
                                                    key={i}
                                                    style={{
                                                        background: 'rgba(37,99,235,0.1)',
                                                        color: 'var(--primary)',
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.3rem'
                                                    }}
                                                >
                                                    {al}
                                                    <X 
                                                        size={12} 
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => {
                                                            setFormData({
                                                                ...formData,
                                                                aliases: formData.aliases.filter((_, idx) => idx !== i)
                                                            });
                                                        }}
                                                    />
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                                    <button 
                                        type="button" 
                                        className="btn" 
                                        onClick={() => setModalOpen(false)}
                                        style={{ background: 'transparent', border: '1px solid var(--border)' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary"
                                    >
                                        Guardar Dependencia
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

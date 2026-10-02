import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { motion } from 'framer-motion';
import { 
    Settings, 
    Upload, 
    FileText, 
    CheckCircle, 
    ArrowLeft, 
    Trash2, 
    X, 
    AlertCircle, 
    Layers,
    Download,
    Cloud,
    ExternalLink,
    RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const REQUIRED_FORMATS = [
    {
        key: 'supervisor',
        name: 'FORMATO CERTIFICADO DEL SUPERVISOR.docx',
        title: 'Certificado del Supervisor',
        description: 'Certificación de cumplimiento mensual emitida por el supervisor.',
        match: (name) => name.toLowerCase().includes('supervisor') || name.toLowerCase().includes('certificado')
    },
    {
        key: 'informe',
        name: 'FORMATO INFORME DE ACTIVIDADES.docx',
        title: 'Informe de Actividades',
        description: 'Relación de obligaciones contractuales y evidencias de soporte.',
        match: (name) => name.toLowerCase().includes('informe') || name.toLowerCase().includes('actividad')
    },
    {
        key: 'estampillas',
        name: 'FORMATO DESCUENTO DE ESTAMPILLAS.docx',
        title: 'Descuento de Estampillas',
        description: 'Autorización voluntaria para retenciones de estampillas municipales.',
        match: (name) => name.toLowerCase().includes('estampilla')
    },
    {
        key: 'retencion',
        name: 'FORMATO RETENCION EN LA FUENTE.docx',
        title: 'Retención en la Fuente',
        description: 'Certificado de ingresos, base de cotización y aportes PILA.',
        match: (name) => name.toLowerCase().includes('retencion') || name.toLowerCase().includes('fuente')
    },
    {
        key: 'anexo',
        name: 'FORMATO ANEXO DESCRIPCION.docx',
        title: 'Anexo Descripción',
        description: 'Plantilla base oficial para el informe detallado de evidencias y actividades.',
        match: (name) => name.toLowerCase().includes('anexo') && name.toLowerCase().includes('descripcion')
    }
];

const detectFormat = (filename) => {
    const clean = filename.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const fmt of REQUIRED_FORMATS) {
        if (fmt.match(clean)) {
            return { label: fmt.title, color: '#3b82f6', isStandard: true };
        }
    }
    return { label: 'Formato Adicional', color: 'var(--text-muted)', isStandard: false };
};

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const ConfigureFormats = () => {
    const navigate = useNavigate();
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [existingTemplates, setExistingTemplates] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [downloadingName, setDownloadingName] = useState(null);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [isDragging, setIsDragging] = useState(false);

    const fetchTemplates = async () => {
        try {
            setLoadingTemplates(true);
            const { data } = await api.get('/admin/templates');
            setExistingTemplates(data || []);
        } catch (error) {
            console.error('Error al cargar plantillas:', error);
            setMessage({
                text: 'Error al conectar con el servidor para listar plantillas',
                type: 'error'
            });
        } finally {
            setLoadingTemplates(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    // Helper: Descargar cualquier plantilla
    const handleDownloadTemplate = async (filename) => {
        try {
            setDownloadingName(filename);
            const response = await api.get(`/admin/templates/${encodeURIComponent(filename)}/download`, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error al descargar plantilla:', err);
            setMessage({
                text: `Error al descargar "${filename}": ` + (err.response?.data?.message || err.message),
                type: 'error'
            });
        } finally {
            setDownloadingName(null);
        }
    };

    // Helper: Subir o actualizar una sola plantilla directamente
    const handleSingleUpload = async (file, forcedName) => {
        if (!file) return;
        setUploading(true);
        setMessage({ text: '', type: '' });

        const formData = new FormData();
        const uploadFile = forcedName ? new File([file], forcedName, { type: file.type }) : file;
        formData.append('templateFiles', uploadFile);

        try {
            const { data } = await api.post('/admin/template', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setMessage({
                text: data.message || `Plantilla "${uploadFile.name}" guardada y sincronizada con éxito`,
                type: 'success'
            });
            await fetchTemplates();
        } catch (error) {
            setMessage({
                text: 'Error al subir plantilla: ' + (error.response?.data?.error || error.response?.data?.message || error.message),
                type: 'error'
            });
        } finally {
            setUploading(false);
            setTimeout(() => setMessage({ text: '', type: '' }), 6000);
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            addFiles(files);
        }
        e.target.value = '';
    };

    const addFiles = (newFiles) => {
        const valid = newFiles.filter(f => f.name.endsWith('.docx') || f.name.endsWith('.doc'));
        if (valid.length < newFiles.length) {
            setMessage({
                text: 'Se omitieron algunos archivos que no son .docx o .doc',
                type: 'warning'
            });
        }
        setSelectedFiles(prev => {
            const existingNames = new Set(prev.map(f => f.name));
            const filtered = valid.filter(f => !existingNames.has(f.name));
            return [...prev, ...filtered];
        });
    };

    const removeSelectedFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length > 0) {
            addFiles(files);
        }
    };

    const handleUploadAll = async () => {
        if (selectedFiles.length === 0) return;
        setUploading(true);
        setMessage({ text: '', type: '' });

        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('templateFiles', file);
        });

        try {
            const { data } = await api.post('/admin/template', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setMessage({
                text: data.message || 'Plantillas sincronizadas con éxito en Google Drive y servidor local',
                type: 'success'
            });
            setSelectedFiles([]);
            await fetchTemplates();
        } catch (error) {
            setMessage({
                text: 'Error al subir plantillas: ' + (error.response?.data?.error || error.response?.data?.message || error.message),
                type: 'error'
            });
        } finally {
            setUploading(false);
            setTimeout(() => setMessage({ text: '', type: '' }), 6000);
        }
    };

    const handleDeleteTemplate = async (filename) => {
        if (!window.confirm(`¿Seguro que deseas eliminar la plantilla "${filename}" de Google Drive y del servidor?`)) return;
        try {
            await api.delete(`/admin/templates/${encodeURIComponent(filename)}`);
            setMessage({
                text: `Plantilla "${filename}" eliminada.`,
                type: 'success'
            });
            await fetchTemplates();
        } catch (error) {
            setMessage({
                text: 'Error al eliminar plantilla: ' + (error.response?.data?.message || error.message),
                type: 'error'
            });
        }
    };

    return (
        <div className="container" style={{ padding: '2rem 0', maxWidth: '1100px', margin: '0 auto' }}>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass" style={{ padding: '2.5rem', borderRadius: 'var(--radius-lg)' }}>
                <button 
                    onClick={() => navigate('/dashboard')} 
                    className="btn" 
                    style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        marginBottom: '1.5rem', 
                        background: 'transparent', 
                        border: '1px solid var(--border)', 
                        color: 'var(--text-main)', 
                        padding: '0.5rem 1rem', 
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-md)',
                        transition: 'all 0.2s'
                    }}
                >
                    <ArrowLeft size={16} />
                    Volver al Panel
                </button>

                <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: 'var(--radius-md)', display: 'flex' }}>
                            <Settings size={28} color="var(--primary)" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Formatos Maestros de Cuentas de Cobro</h1>
                            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
                                Gestiona las plantillas de Word (.docx) sincronizadas en tiempo real con <strong>Google Drive</strong> y el servidor.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={fetchTemplates} 
                        disabled={loadingTemplates}
                        className="btn" 
                        style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.03)',
                            fontSize: '0.85rem'
                        }}
                    >
                        <RefreshCw size={15} className={loadingTemplates ? 'spin' : ''} />
                        Sincronizar Lista
                    </button>
                </header>

                {/* Alerts / Feedback */}
                {message.text && (
                    <div 
                        style={{ 
                            padding: '1rem 1.25rem', 
                            marginBottom: '2rem',
                            background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : message.type === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                            color: message.type === 'error' ? '#ef4444' : message.type === 'warning' ? '#f59e0b' : 'var(--success)', 
                            borderRadius: 'var(--radius-md)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.75rem',
                            border: `1px solid ${message.type === 'error' ? '#ef444430' : message.type === 'warning' ? '#f59e0b30' : '#10b98130'}`
                        }}
                    >
                        {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                        <span style={{ fontSize: '0.9rem' }}>{message.text}</span>
                    </div>
                )}

                {/* Status of standard formats */}
                <div style={{ marginBottom: '2.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Layers size={18} color="var(--primary)" />
                        Formatos Oficiales del Sistema (Descarga y Actualización Directa)
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                        {REQUIRED_FORMATS.map(fmt => {
                            const matched = existingTemplates.find(t => t.name.toLowerCase() === fmt.name.toLowerCase() || fmt.match(t.name.toLowerCase()));
                            const isPresent = Boolean(matched);
                            const inDrive = matched?.inDrive;

                            return (
                                <div 
                                    key={fmt.key}
                                    style={{
                                        padding: '1.25rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: isPresent ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border)',
                                        background: isPresent ? 'rgba(16, 185, 129, 0.04)' : 'var(--bg-card, rgba(255,255,255,0.02))',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        gap: '0.9rem'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ 
                                                fontSize: '0.72rem', 
                                                fontWeight: 600, 
                                                textTransform: 'uppercase', 
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.3rem',
                                                color: isPresent ? (inDrive ? '#38bdf8' : 'var(--success)') : 'var(--text-muted)' 
                                            }}>
                                                {isPresent ? (
                                                    inDrive ? (
                                                        <><Cloud size={13} /> Sincronizado en Drive</>
                                                    ) : (
                                                        <><CheckCircle size={13} /> Activo en Servidor</>
                                                    )
                                                ) : 'Falta Cargar'}
                                            </span>
                                            {isPresent ? (
                                                <CheckCircle size={17} color="var(--success)" />
                                            ) : (
                                                <AlertCircle size={17} color="var(--warning, #f59e0b)" />
                                            )}
                                        </div>

                                        <div style={{ fontWeight: 600, fontSize: '0.98rem', marginBottom: '0.25rem' }}>{fmt.title}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.35', marginBottom: '0.5rem' }}>{fmt.description}</div>
                                        
                                        <div style={{ fontSize: '0.73rem', fontFamily: 'monospace', color: 'var(--text-muted)', wordBreak: 'break-all', background: 'rgba(0,0,0,0.15)', padding: '0.3rem 0.5rem', borderRadius: '4px' }}>
                                            {matched ? matched.name : fmt.name}
                                            {matched?.size ? ` • ${formatBytes(matched.size)}` : ''}
                                        </div>
                                    </div>

                                    {/* Action buttons on the card */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                        {/* Download Button */}
                                        <button 
                                            onClick={() => handleDownloadTemplate(matched ? matched.name : fmt.name)}
                                            disabled={!isPresent || downloadingName === (matched?.name || fmt.name)}
                                            className="btn"
                                            style={{
                                                flex: 1,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.4rem',
                                                fontSize: '0.8rem',
                                                padding: '0.45rem 0.65rem',
                                                border: '1px solid var(--border)',
                                                background: isPresent ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                                color: isPresent ? 'var(--text-main)' : 'var(--text-muted)',
                                                cursor: isPresent ? 'pointer' : 'not-allowed',
                                                borderRadius: 'var(--radius-sm)'
                                            }}
                                            title={isPresent ? `Descargar ${matched ? matched.name : fmt.name}` : 'Formato no disponible para descargar'}
                                        >
                                            <Download size={14} color="var(--primary)" />
                                            {downloadingName === (matched?.name || fmt.name) ? 'Descargando...' : 'Descargar'}
                                        </button>

                                        {/* Direct Update/Upload Button */}
                                        <label 
                                            className="btn btn-primary"
                                            style={{
                                                flex: 1,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.4rem',
                                                fontSize: '0.8rem',
                                                padding: '0.45rem 0.65rem',
                                                cursor: uploading ? 'wait' : 'pointer',
                                                borderRadius: 'var(--radius-sm)',
                                                margin: 0
                                            }}
                                            title={`Cargar o reemplazar ${fmt.name}`}
                                        >
                                            <Upload size={14} />
                                            {isPresent ? 'Actualizar' : 'Cargar'}
                                            <input 
                                                type="file" 
                                                accept=".docx,.doc" 
                                                style={{ display: 'none' }} 
                                                disabled={uploading}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        handleSingleUpload(file, fmt.name);
                                                    }
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>

                                        {/* Open in Drive icon if available */}
                                        {matched?.webViewLink && (
                                            <a 
                                                href={matched.webViewLink} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '0.45rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid var(--border)',
                                                    color: '#38bdf8',
                                                    textDecoration: 'none'
                                                }}
                                                title="Abrir en Google Drive"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Upload Section (Multiple files) */}
                <div style={{ display: 'grid', gridTemplateColumns: selectedFiles.length > 0 ? '1fr 1fr' : '1fr', gap: '2rem', marginBottom: '2.5rem' }}>
                    {/* Drag & Drop Area */}
                    <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        style={{ 
                            padding: '2.5rem 1.5rem', 
                            border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`, 
                            borderRadius: 'var(--radius-lg)', 
                            textAlign: 'center',
                            background: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                        onClick={() => document.getElementById('multi-template-input').click()}
                    >
                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
                            <Upload size={32} color="var(--primary)" />
                        </div>
                        <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>Carga Masiva de Plantillas</h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem', maxWidth: '380px' }}>
                            Arrastra o selecciona múltiples archivos (.docx) simultáneamente. Se sincronizarán automáticamente con <strong>Google Drive</strong> y la carpeta del servidor.
                        </p>

                        <input 
                            id="multi-template-input"
                            type="file" 
                            style={{ display: 'none' }} 
                            accept=".docx,.doc" 
                            multiple 
                            onChange={handleFileChange} 
                        />
                        <button 
                            type="button"
                            className="btn btn-primary" 
                            style={{ pointerEvents: 'none' }}
                        >
                            Explorar Archivos (.docx)
                        </button>
                    </div>

                    {/* Files to Upload Queue */}
                    {selectedFiles.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--bg-card, rgba(255,255,255,0.02))', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h4 style={{ margin: 0, fontSize: '1rem' }}>
                                        Archivos Listos para Subir ({selectedFiles.length})
                                    </h4>
                                    <button 
                                        onClick={() => setSelectedFiles([])}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}
                                    >
                                        Limpiar todo
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                                    {selectedFiles.map((f, i) => {
                                        const detected = detectFormat(f.name);
                                        return (
                                            <div 
                                                key={i} 
                                                style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'space-between', 
                                                    padding: '0.65rem 0.85rem', 
                                                    background: 'rgba(255,255,255,0.03)', 
                                                    borderRadius: 'var(--radius-md)', 
                                                    border: '1px solid var(--border)'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                                                    <FileText size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div style={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {f.name}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.2rem' }}>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatBytes(f.size)}</span>
                                                            <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: `${detected.color}20`, color: detected.color, fontWeight: 500 }}>
                                                                {detected.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); removeSelectedFile(i); }} 
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                                                    title="Quitar"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ marginTop: '1.25rem' }}>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ width: '100%', background: 'var(--success)' }} 
                                    disabled={uploading} 
                                    onClick={handleUploadAll}
                                >
                                    {uploading ? 'Sincronizando con Drive y Servidor...' : `Guardar y Aplicar ${selectedFiles.length} Plantilla(s)`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Existing Templates Table */}
                <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={18} color="var(--primary)" />
                        Plantillas Activas en el Sistema ({existingTemplates.length})
                    </h3>

                    {loadingTemplates ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Cargando plantillas de Google Drive y servidor...
                        </div>
                    ) : existingTemplates.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
                            No hay plantillas guardadas en el servidor ni en Google Drive. Sube tus archivos .docx arriba para activarlas.
                        </div>
                    ) : (
                        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Nombre del Archivo</th>
                                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Tipo Detectado</th>
                                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Ubicación</th>
                                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Tamaño</th>
                                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Última Modificación</th>
                                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'center' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {existingTemplates.map((tpl, i) => {
                                        const detected = detectFormat(tpl.name);
                                        return (
                                            <tr key={i} style={{ borderBottom: i < existingTemplates.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                                <td style={{ padding: '0.85rem 1rem', fontWeight: 500 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <FileText size={16} color="var(--primary)" />
                                                        <span>{tpl.name}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                    <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: `${detected.color}20`, color: detected.color, fontWeight: 500 }}>
                                                        {detected.label}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                    {tpl.inDrive ? (
                                                        <span style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                                                            <Cloud size={13} /> Google Drive
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            💾 Local
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                                                    {formatBytes(tpl.size)}
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                                                    {tpl.modifiedAt ? new Date(tpl.modifiedAt).toLocaleDateString() + ' ' + new Date(tpl.modifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {/* Download button */}
                                                        <button 
                                                            onClick={() => handleDownloadTemplate(tpl.name)}
                                                            disabled={downloadingName === tpl.name}
                                                            style={{ 
                                                                background: 'transparent', 
                                                                border: 'none', 
                                                                color: 'var(--text-main)', 
                                                                cursor: 'pointer', 
                                                                padding: '0.35rem', 
                                                                borderRadius: 'var(--radius-sm)',
                                                                display: 'inline-flex',
                                                                alignItems: 'center'
                                                            }}
                                                            title="Descargar plantilla .docx"
                                                        >
                                                            <Download size={16} color="var(--primary)" />
                                                        </button>

                                                        {/* Open in Drive link if available */}
                                                        {tpl.webViewLink && (
                                                            <a 
                                                                href={tpl.webViewLink} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                style={{ 
                                                                    color: 'var(--text-muted)', 
                                                                    padding: '0.35rem', 
                                                                    display: 'inline-flex', 
                                                                    alignItems: 'center' 
                                                                }}
                                                                title="Ver en Google Drive"
                                                            >
                                                                <ExternalLink size={16} />
                                                            </a>
                                                        )}

                                                        {/* Delete button */}
                                                        <button 
                                                            onClick={() => handleDeleteTemplate(tpl.name)}
                                                            style={{ 
                                                                background: 'transparent', 
                                                                border: 'none', 
                                                                color: 'var(--text-muted)', 
                                                                cursor: 'pointer', 
                                                                padding: '0.35rem', 
                                                                borderRadius: 'var(--radius-sm)',
                                                                transition: 'color 0.2s',
                                                                display: 'inline-flex',
                                                                alignItems: 'center'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                                            title="Eliminar plantilla"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default ConfigureFormats;

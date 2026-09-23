import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Download, Eye, Trash2, Search, Filter,
    ArrowLeft, RefreshCw, AlertCircle, CheckCircle2,
    Package, Shield, FileCheck, Layers, ExternalLink,
    AlertTriangle, X, Loader2, Users, Calendar
} from 'lucide-react';

const CATEGORY_COLORS = {
    'Contrato Base': { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.25)' },
    'Seguridad Social': { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: 'rgba(16, 185, 129, 0.25)' },
    'Evidencias': { bg: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.25)' },
    'Paquete ZIP': { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' }
};

export default function AdminDocuments() {
    const navigate = useNavigate();
    const location = useLocation();

    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedContractorId, setSelectedContractorId] = useState('all');
    
    // Deletion Modal state
    const [docToDelete, setDocToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Feedback alert
    const [feedback, setFeedback] = useState(null);

    // Read initial userId query param if present
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const userParam = queryParams.get('userId');
        if (userParam) {
            setSelectedContractorId(userParam);
        }
    }, [location.search]);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/documents');
            setDocuments(data);
        } catch (error) {
            console.error('Error al cargar documentos:', error);
            showFeedback('error', 'No se pudieron cargar los documentos del sistema.');
        } finally {
            setLoading(false);
        }
    };

    const showFeedback = (type, message) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 6000);
    };

    // Format bytes
    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Format date
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('es-CO', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Extract unique contractors for filter dropdown
    const uniqueContractors = useMemo(() => {
        const map = new Map();
        documents.forEach(d => {
            if (d.contractor && d.contractor.id) {
                map.set(d.contractor.id, {
                    id: d.contractor.id,
                    name: d.contractor.fullName || 'Sin nombre',
                    cedula: d.contractor.cedula
                });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [documents]);

    // Filter documents
    const filteredDocuments = useMemo(() => {
        return documents.filter(doc => {
            // Category filter
            if (selectedCategory !== 'all' && doc.category !== selectedCategory) {
                return false;
            }

            // Contractor filter
            if (selectedContractorId !== 'all' && doc.contractor?.id !== selectedContractorId) {
                return false;
            }

            // Search query
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchName = doc.contractor?.fullName?.toLowerCase().includes(term);
                const matchEmail = doc.contractor?.email?.toLowerCase().includes(term);
                const matchCedula = doc.contractor?.cedula?.toLowerCase().includes(term);
                const matchTitle = doc.title?.toLowerCase().includes(term);
                const matchFileName = doc.fileName?.toLowerCase().includes(term);
                const matchCategory = doc.category?.toLowerCase().includes(term);

                if (!matchName && !matchEmail && !matchCedula && !matchTitle && !matchFileName && !matchCategory) {
                    return false;
                }
            }

            return true;
        });
    }, [documents, selectedCategory, selectedContractorId, searchTerm]);

    // Category KPI counts
    const kpis = useMemo(() => {
        return {
            total: documents.length,
            contract: documents.filter(d => d.category === 'Contrato Base').length,
            ss: documents.filter(d => d.category === 'Seguridad Social').length,
            evidences: documents.filter(d => d.category === 'Evidencias').length,
            zips: documents.filter(d => d.category === 'Paquete ZIP').length
        };
    }, [documents]);

    // Handle delete execution
    const confirmDelete = async () => {
        if (!docToDelete) return;
        setIsDeleting(true);
        try {
            const { data } = await api.delete('/admin/documents', {
                data: docToDelete.target
            });

            showFeedback('success', data.message || 'Documento eliminado con éxito.');
            setDocToDelete(null);
            // Refresh list
            await fetchDocuments();
        } catch (error) {
            console.error('Error al eliminar documento:', error);
            showFeedback('error', 'Error al eliminar: ' + (error.response?.data?.message || error.message));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--text-main)' }}>
            <div className="container" style={{ padding: '2rem 0 5rem' }}>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    
                    {/* Top Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <button 
                            onClick={() => navigate('/dashboard')} 
                            className="btn" 
                            style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '0.5rem', 
                                background: 'transparent', 
                                border: '1px solid var(--border)', 
                                color: 'var(--text-main)', 
                                padding: '0.5rem 1rem', 
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-md)'
                            }}
                        >
                            <ArrowLeft size={16} /> Volver al Panel
                        </button>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                                onClick={() => navigate('/admin/users')} 
                                className="btn"
                                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.825rem', padding: '0.45rem 0.85rem' }}
                            >
                                <Users size={14} style={{ display: 'inline', marginRight: '4px' }} /> Directorio Contratistas
                            </button>
                            <button 
                                onClick={fetchDocuments} 
                                className="btn"
                                disabled={loading}
                                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--primary)', fontSize: '0.825rem', padding: '0.45rem 0.85rem' }}
                            >
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ display: 'inline', marginRight: '4px' }} /> Actualizar
                            </button>
                        </div>
                    </div>

                    {/* Feedback Alert */}
                    {feedback && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            style={{
                                padding: '1rem 1.25rem',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                border: `1px solid ${feedback.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
                                color: feedback.type === 'success' ? 'var(--success)' : 'var(--error)'
                            }}
                        >
                            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{feedback.message}</span>
                        </motion.div>
                    )}

                    {/* Header */}
                    <header style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.65rem', borderRadius: 'var(--radius-md)', display: 'flex' }}>
                                <Layers size={28} color="var(--primary)" />
                            </div>
                            <div>
                                <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Gestión y Eliminación de Documentos y ZIPs</h1>
                                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
                                    Supervisa, descarga y elimina archivos de soporte, minutas, actas, planillas y paquetes ZIP cargados por los contratistas para permitir su reenvío.
                                </p>
                            </div>
                        </div>
                    </header>

                    {/* KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        <div className="glass" style={{ padding: '1.15rem', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Total Archivos</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{kpis.total}</div>
                        </div>
                        <div className="glass" style={{ padding: '1.15rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #3b82f6' }}>
                            <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginBottom: '0.25rem' }}>Contratos Base</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{kpis.contract}</div>
                        </div>
                        <div className="glass" style={{ padding: '1.15rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #10b981' }}>
                            <div style={{ fontSize: '0.78rem', color: '#10b981', marginBottom: '0.25rem' }}>Planillas SS</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{kpis.ss}</div>
                        </div>
                        <div className="glass" style={{ padding: '1.15rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #a855f7' }}>
                            <div style={{ fontSize: '0.78rem', color: '#a855f7', marginBottom: '0.25rem' }}>Evidencias</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{kpis.evidences}</div>
                        </div>
                        <div className="glass" style={{ padding: '1.15rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #f59e0b' }}>
                            <div style={{ fontSize: '0.78rem', color: '#f59e0b', marginBottom: '0.25rem' }}>Paquetes ZIP</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{kpis.zips}</div>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        {/* Search Input */}
                        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '420px' }}>
                            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                            <input 
                                type="text" 
                                className="input" 
                                placeholder="Buscar por contratista, cédula o documento..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '2.75rem', width: '100%' }}
                            />
                        </div>

                        {/* Dropdown by contractor */}
                        <div style={{ minWidth: '220px', flex: '0 1 280px' }}>
                            <select 
                                className="input" 
                                value={selectedContractorId} 
                                onChange={(e) => setSelectedContractorId(e.target.value)}
                                style={{ width: '100%', fontSize: '0.85rem' }}
                            >
                                <option value="all">Todos los Contratistas ({uniqueContractors.length})</option>
                                {uniqueContractors.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} {c.cedula !== 'Sin cédula' ? `(C.C. ${c.cedula})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Category Filter Pills */}
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {[
                                { key: 'all', label: 'Todos' },
                                { key: 'Contrato Base', label: 'Contratos' },
                                { key: 'Seguridad Social', label: 'Planillas' },
                                { key: 'Evidencias', label: 'Evidencias' },
                                { key: 'Paquete ZIP', label: 'ZIPs' }
                            ].map(cat => (
                                <button 
                                    key={cat.key}
                                    onClick={() => setSelectedCategory(cat.key)}
                                    className="btn"
                                    style={{ 
                                        padding: '0.35rem 0.75rem', 
                                        fontSize: '0.78rem', 
                                        background: selectedCategory === cat.key ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                        color: selectedCategory === cat.key ? 'white' : 'var(--text-main)',
                                        border: '1px solid var(--border)'
                                    }}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Document List Table */}
                    {loading ? (
                        <div className="glass" style={{ padding: '3rem', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
                            <Loader2 size={32} className="animate-spin" color="var(--primary)" style={{ margin: '0 auto 1rem' }} />
                            <p style={{ color: 'var(--text-muted)' }}>Cargando catálogo de documentos del sistema...</p>
                        </div>
                    ) : (
                        <div className="glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                                    <thead style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border)' }}>
                                        <tr>
                                            <th style={{ padding: '1rem', width: '22%' }}>Contratista</th>
                                            <th style={{ padding: '1rem', width: '14%' }}>Categoría</th>
                                            <th style={{ padding: '1rem', width: '28%' }}>Nombre del Soporte</th>
                                            <th style={{ padding: '1rem', width: '12%' }}>Detalle / Acta</th>
                                            <th style={{ padding: '1rem', width: '10%' }}>Tamaño</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '14%' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDocuments.map(doc => {
                                            const catStyle = CATEGORY_COLORS[doc.category] || CATEGORY_COLORS['Contrato Base'];
                                            return (
                                                <tr key={doc.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                                                    {/* Contractor info */}
                                                    <td style={{ padding: '0.9rem 1rem' }}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{doc.contractor?.fullName}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                            C.C. {doc.contractor?.cedula}
                                                        </div>
                                                    </td>

                                                    {/* Category badge */}
                                                    <td style={{ padding: '0.9rem 1rem' }}>
                                                        <span style={{ 
                                                            display: 'inline-block',
                                                            fontSize: '0.72rem', 
                                                            fontWeight: 600, 
                                                            padding: '0.2rem 0.55rem', 
                                                            borderRadius: '12px',
                                                            background: catStyle.bg, 
                                                            color: catStyle.color,
                                                            border: `1px solid ${catStyle.border}`
                                                        }}>
                                                            {doc.category}
                                                        </span>
                                                    </td>

                                                    {/* Document title and file name */}
                                                    <td style={{ padding: '0.9rem 1rem' }}>
                                                        <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{doc.title}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                                                            {doc.fileName}
                                                        </div>
                                                    </td>

                                                    {/* Detail / Period */}
                                                    <td style={{ padding: '0.9rem 1rem' }}>
                                                        {doc.periodInfo?.actNumber ? (
                                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>
                                                                Acta N° {doc.periodInfo.actNumber}
                                                            </span>
                                                        ) : (
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Contrato General</span>
                                                        )}
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                            {formatDate(doc.uploadedAt)}
                                                        </div>
                                                    </td>

                                                    {/* File Size */}
                                                    <td style={{ padding: '0.9rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                        {doc.exists ? formatBytes(doc.fileSize) : <span style={{ color: 'var(--error)' }}>No en disco</span>}
                                                    </td>

                                                    {/* Actions: View & Delete */}
                                                    <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                                                            {/* View / Download button */}
                                                            <a 
                                                                href={doc.fileUrl} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="btn"
                                                                title="Ver o descargar archivo"
                                                                style={{ 
                                                                    padding: '0.35rem 0.6rem', 
                                                                    fontSize: '0.75rem', 
                                                                    display: 'inline-flex', 
                                                                    alignItems: 'center', 
                                                                    gap: '0.25rem',
                                                                    background: 'rgba(59, 130, 246, 0.1)',
                                                                    color: 'var(--primary)',
                                                                    border: '1px solid rgba(59, 130, 246, 0.25)',
                                                                    borderRadius: 'var(--radius-md)'
                                                                }}
                                                            >
                                                                <Eye size={13} /> Ver
                                                            </a>

                                                            {/* Delete button */}
                                                            <button 
                                                                onClick={() => setDocToDelete(doc)}
                                                                className="btn"
                                                                title="Eliminar soporte para permitir reenvío"
                                                                style={{ 
                                                                    padding: '0.35rem 0.6rem', 
                                                                    fontSize: '0.75rem', 
                                                                    display: 'inline-flex', 
                                                                    alignItems: 'center', 
                                                                    gap: '0.25rem',
                                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                                    color: 'var(--error)',
                                                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                                                    borderRadius: 'var(--radius-md)',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <Trash2 size={13} /> Eliminar
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {filteredDocuments.length === 0 && (
                                            <tr>
                                                <td colSpan="6" style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                    <FileText size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                                                    <p style={{ margin: 0, fontWeight: 500 }}>No se encontraron documentos con los filtros seleccionados.</p>
                                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>Intenta cambiando los términos de búsqueda o seleccionando otra categoría.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Delete Confirmation Modal */}
                    <AnimatePresence>
                        {docToDelete && (
                            <div style={{
                                position: 'fixed',
                                inset: 0,
                                background: 'rgba(0,0,0,0.75)',
                                backdropFilter: 'blur(5px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1100,
                                padding: '1rem'
                            }}>
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="glass"
                                    style={{
                                        width: '100%',
                                        maxWidth: '500px',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: '2rem',
                                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
                                        border: '1px solid rgba(239, 68, 68, 0.4)',
                                        textAlign: 'center'
                                    }}
                                >
                                    <div style={{
                                        width: '56px',
                                        height: '56px',
                                        borderRadius: '50%',
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        color: 'var(--error)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 1.25rem'
                                    }}>
                                        <AlertTriangle size={30} />
                                    </div>

                                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                                        ¿Eliminar este documento del sistema?
                                    </h3>

                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', textAlign: 'left', margin: '1rem 0' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Contratista:</div>
                                        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{docToDelete.contractor?.fullName} (C.C. {docToDelete.contractor?.cedula})</div>

                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Documento / Soporte:</div>
                                        <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem' }}>{docToDelete.title}</div>

                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nombre de archivo:</div>
                                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>{docToDelete.fileName}</div>
                                    </div>

                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                                        El archivo físico será eliminado del servidor y su enlace se limpiará en la base de datos.
                                        El contratista <strong>podrá volver a cargarlo de inmediato</strong> en su panel para subsanar cualquier error.
                                    </p>

                                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                                        <button 
                                            className="btn" 
                                            disabled={isDeleting}
                                            onClick={() => setDocToDelete(null)}
                                            style={{ border: '1px solid var(--border)', padding: '0.6rem 1.25rem' }}
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            className="btn" 
                                            disabled={isDeleting}
                                            onClick={confirmDelete}
                                            style={{ 
                                                background: 'var(--error)', 
                                                color: 'white', 
                                                padding: '0.6rem 1.5rem',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                fontWeight: 600
                                            }}
                                        >
                                            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                            {isDeleting ? 'Eliminando...' : 'Sí, Eliminar Documento'}
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                </motion.div>
            </div>
        </div>
    );
}

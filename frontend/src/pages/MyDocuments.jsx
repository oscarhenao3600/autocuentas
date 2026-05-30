import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { motion } from 'framer-motion';
import {
    FileText, Download, Clock, CheckCircle, XCircle,
    ArrowLeft, Package, RefreshCw, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ── Status helpers ────────────────────────────────────────────
function StatusBadge({ status }) {
    const map = {
        approved: { icon: <CheckCircle size={14} />, label: 'Aprobado',  color: 'var(--success)' },
        rejected: { icon: <XCircle    size={14} />, label: 'Rechazado', color: 'var(--error)'   },
        pending:  { icon: <Clock      size={14} />, label: 'Pendiente', color: 'var(--accent)'  },
    };
    const s = map[status] || map.pending;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.25rem 0.65rem', borderRadius: '999px',
            background: `${s.color}22`, color: s.color,
            fontSize: '0.75rem', fontWeight: 600
        }}>
            {s.icon} {s.label}
        </span>
    );
}

// ── Main component ────────────────────────────────────────────
const MyDocuments = () => {
    const navigate = useNavigate();
    const [periods,  setPeriods]  = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [genId,    setGenId]    = useState(null);   // generating state per card
    const [error,    setError]    = useState('');

    useEffect(() => { fetchPeriods(); }, []);

    const fetchPeriods = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/billing');
            setPeriods(data);
        } catch (err) {
            setError('No se pudo cargar el historial: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    // Re-generate package for an existing period
    const handleRegenerate = async (id) => {
        setGenId(id);
        try {
            const { data } = await api.post(`/billing/${id}/generate`);
            setPeriods(prev => prev.map(p => p._id === id ? { ...p, zipPath: 'generated', status: p.status } : p));
            // Download immediately
            if (data.zipUrl) {
                const base = (import.meta.env.VITE_API_URL || '').replace('/api', '');
                window.open(`${base}${data.zipUrl}`, '_blank');
            }
            await fetchPeriods();
        } catch (err) {
            alert('Error al regenerar: ' + (err.response?.data?.message || err.message));
        } finally {
            setGenId(null);
        }
    };

    const handleDownload = (id) => {
        window.location.href = `/api/billing/${id}/download`;
    };

    const fmtDate = (d) => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

    // ─────────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--text-main)' }}>
            <div className="container" style={{ padding: '2rem 0 4rem' }}>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

                    {/* Back button */}
                    <button onClick={() => navigate('/dashboard')} className="btn" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        marginBottom: '1.5rem', background: 'transparent',
                        border: '1px solid var(--border)', color: 'var(--text-main)',
                        padding: '0.5rem 1rem', fontSize: '0.875rem',
                        cursor: 'pointer', borderRadius: 'var(--radius-md)', transition: 'all 0.2s'
                    }}>
                        <ArrowLeft size={16} /> Volver al Panel
                    </button>

                    <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h1 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Package color="var(--primary)" size={28} /> Mis Cuentas de Cobro
                            </h1>
                            <p style={{ color: 'var(--text-muted)' }}>
                                Historial de periodos de cobro generados. Descarga o regenera cualquier paquete.
                            </p>
                        </div>
                        <button className="btn" style={{ border: '1px solid var(--border)' }} onClick={fetchPeriods}>
                            <RefreshCw size={16} /> Actualizar
                        </button>
                    </header>

                    {error && (
                        <div style={{
                            display: 'flex', gap: '0.75rem', alignItems: 'center',
                            padding: '0.875rem 1rem', background: 'rgba(239,68,68,0.1)',
                            border: '1px solid var(--error)', borderRadius: 'var(--radius-md)',
                            marginBottom: '1.5rem', color: 'var(--error)', fontSize: '0.875rem'
                        }}>
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                            <RefreshCw size={36} style={{ opacity: 0.4, marginBottom: '1rem' }} />
                            <p>Cargando historial...</p>
                        </div>
                    ) : periods.length === 0 ? (
                        <div className="glass" style={{
                            padding: '4rem 2rem', textAlign: 'center',
                            borderRadius: 'var(--radius-lg)', display: 'flex',
                            flexDirection: 'column', alignItems: 'center', gap: '1rem'
                        }}>
                            <FileText size={52} color="var(--text-muted)" style={{ opacity: 0.4 }} />
                            <p style={{ color: 'var(--text-muted)' }}>Aún no has generado ninguna cuenta de cobro.</p>
                            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                                Crear Primera Cuenta
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                            {periods.map((period, idx) => (
                                <motion.div
                                    key={period._id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="glass"
                                    style={{
                                        padding: '1.5rem', borderRadius: 'var(--radius-lg)',
                                        display: 'flex', flexDirection: 'column', gap: '1rem',
                                        borderTop: '3px solid var(--primary)'
                                    }}
                                >
                                    {/* Card header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.2rem' }}>
                                                Acta No. {period.actNumber}
                                            </p>
                                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                {period.periodFrom ? fmtDate(period.periodFrom) : '—'} → {period.periodTo ? fmtDate(period.periodTo) : '—'}
                                            </p>
                                        </div>
                                        <StatusBadge status={period.status} />
                                    </div>

                                    {/* Details */}
                                    <div style={{
                                        padding: '0.875rem', background: 'var(--surface)',
                                        borderRadius: 'var(--radius-md)', fontSize: '0.8rem',
                                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem',
                                        color: 'var(--text-muted)'
                                    }}>
                                        <span>Actividades:</span>
                                        <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                                            {period.activities?.length || 0}
                                        </span>
                                        <span>Creado:</span>
                                        <span style={{ color: 'var(--text-main)' }}>
                                            {fmtDate(period.createdAt)}
                                        </span>
                                        <span>ZIP:</span>
                                        <span style={{ color: period.zipPath ? 'var(--success)' : 'var(--text-muted)' }}>
                                            {period.zipPath ? '✓ Disponible' : 'No generado'}
                                        </span>
                                    </div>

                                    {/* Action buttons */}
                                    <div style={{ marginTop: 'auto', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        {period.zipPath ? (
                                            <button
                                                className="btn btn-primary"
                                                style={{ flex: 1, gap: '0.4rem', fontSize: '0.85rem' }}
                                                onClick={() => handleDownload(period._id)}
                                            >
                                                <Download size={16} /> Descargar ZIP
                                            </button>
                                        ) : null}
                                        <button
                                            className="btn"
                                            style={{
                                                flex: 1, gap: '0.4rem', fontSize: '0.85rem',
                                                border: '1px solid var(--border)',
                                                opacity: genId === period._id ? 0.65 : 1
                                            }}
                                            disabled={genId === period._id}
                                            onClick={() => handleRegenerate(period._id)}
                                        >
                                            {genId === period._id
                                                ? <><RefreshCw size={15} /> Generando...</>
                                                : <><RefreshCw size={15} /> {period.zipPath ? 'Regenerar' : 'Generar ZIP'}</>
                                            }
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default MyDocuments;

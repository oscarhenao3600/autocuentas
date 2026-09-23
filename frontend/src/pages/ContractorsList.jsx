import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, 
    Search, 
    ArrowLeft, 
    CreditCard, 
    FileCheck, 
    Send, 
    CheckCircle2, 
    AlertCircle, 
    Eye, 
    X, 
    Phone, 
    Mail, 
    Building, 
    Calendar, 
    DollarSign,
    Layers,
    FileText,
    Sparkles,
    Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ContractorsList = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [contractors, setContractors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterOption, setFilterOption] = useState('all'); // all | with_cedula | without_contract | telegram
    const [selectedContractor, setSelectedContractor] = useState(null);
    const [userToDelete, setUserToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [feedback, setFeedback] = useState(null);

    useEffect(() => {
        fetchContractors();
    }, []);

    const fetchContractors = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/admin/users');
            setContractors(data || []);
        } catch (error) {
            console.error('Error al cargar contratistas:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (c, e) => {
        if (e) e.stopPropagation();
        setUserToDelete(c);
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;
        setDeleting(true);
        try {
            const { data } = await api.delete(`/admin/users/${userToDelete._id}`);
            setFeedback({ type: 'success', message: data.message || 'Usuario eliminado con éxito' });
            setUserToDelete(null);
            if (selectedContractor && selectedContractor._id === userToDelete._id) {
                setSelectedContractor(null);
            }
            await fetchContractors();
        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            setFeedback({ 
                type: 'error', 
                message: error.response?.data?.message || 'Error al eliminar el usuario del sistema' 
            });
        } finally {
            setDeleting(false);
            setTimeout(() => setFeedback(null), 5000);
        }
    };

    // Filter and search (strictly excludes current administrator and any admin accounts)
    const filteredContractors = contractors.filter(c => {
        if (c.role === 'admin' || c._id === currentUser?._id) return false;

        const matchesSearch = 
            (c.cedula || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.contractorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.contractNumber || '').toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        if (filterOption === 'with_cedula') return c.hasContract && c.cedula && !c.cedula.includes('Sin');
        if (filterOption === 'without_contract') return !c.hasContract;
        if (filterOption === 'telegram') return c.telegramLinked;
        return true;
    });

    // KPI stats (excluding admin)
    const nonAdminContractors = contractors.filter(c => c.role !== 'admin' && c._id !== currentUser?._id);
    const totalCount = nonAdminContractors.length;
    const withCedulaCount = nonAdminContractors.filter(c => c.hasContract && c.cedula && !c.cedula.includes('Sin')).length;
    const telegramCount = nonAdminContractors.filter(c => c.telegramLinked).length;
    const pendingPeriodsCount = nonAdminContractors.reduce((acc, c) => acc + (c.periodsPending || 0), 0);

    const formatCurrency = (val) => {
        if (!val) return '$ 0';
        const num = parseFloat(String(val).replace(/\D/g, ''));
        if (isNaN(num)) return val;
        return '$ ' + num.toLocaleString('es-CO');
    };

    return (
        <div className="container" style={{ padding: '2rem 0', maxWidth: '1200px', margin: '0 auto' }}>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {/* Back button */}
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

                {/* Feedback alert */}
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
                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.6rem', borderRadius: 'var(--radius-md)', display: 'flex' }}>
                            <Users size={28} color="var(--primary)" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Directorio de Funcionarios y Contratistas</h1>
                            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
                                Consulta y gestiona los usuarios inscritos para radicar cuentas de cobro, identificados y diferenciados por su <strong>Cédula de Ciudadanía</strong>.
                            </p>
                        </div>
                    </div>
                </header>

                {/* KPI Stat Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                    <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.75rem', borderRadius: '50%', color: 'var(--primary)' }}>
                            <Users size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Inscritos</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalCount}</div>
                        </div>
                    </div>

                    <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '50%', color: 'var(--success)' }}>
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Con Cédula / Contrato</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{withCedulaCount}</div>
                        </div>
                    </div>

                    <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.75rem', borderRadius: '50%', color: '#6366f1' }}>
                            <Send size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Telegram Vinculado</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{telegramCount}</div>
                        </div>
                    </div>

                    <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '50%', color: 'var(--warning, #f59e0b)' }}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cuentas en Trámite</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{pendingPeriodsCount}</div>
                        </div>
                    </div>
                </div>

                {/* Filters and Search Bar */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    {/* Search by Cedula / Name */}
                    <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: '450px' }}>
                        <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                        <input 
                            type="text" 
                            className="input" 
                            placeholder="Buscar por cédula de ciudadanía, nombre o contrato..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '2.75rem', width: '100%' }}
                        />
                    </div>

                    {/* Filter Pills */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button 
                            onClick={() => setFilterOption('all')}
                            className="btn"
                            style={{ 
                                padding: '0.4rem 0.85rem', 
                                fontSize: '0.8rem', 
                                background: filterOption === 'all' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                color: filterOption === 'all' ? 'white' : 'var(--text-main)',
                                border: '1px solid var(--border)'
                            }}
                        >
                            Todos ({totalCount})
                        </button>
                        <button 
                            onClick={() => setFilterOption('with_cedula')}
                            className="btn"
                            style={{ 
                                padding: '0.4rem 0.85rem', 
                                fontSize: '0.8rem', 
                                background: filterOption === 'with_cedula' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                color: filterOption === 'with_cedula' ? 'white' : 'var(--text-main)',
                                border: '1px solid var(--border)'
                            }}
                        >
                            Con Cédula ({withCedulaCount})
                        </button>
                        <button 
                            onClick={() => setFilterOption('without_contract')}
                            className="btn"
                            style={{ 
                                padding: '0.4rem 0.85rem', 
                                fontSize: '0.8rem', 
                                background: filterOption === 'without_contract' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                color: filterOption === 'without_contract' ? 'white' : 'var(--text-main)',
                                border: '1px solid var(--border)'
                            }}
                        >
                            Sin Configurar ({totalCount - withCedulaCount})
                        </button>
                        <button 
                            onClick={() => setFilterOption('telegram')}
                            className="btn"
                            style={{ 
                                padding: '0.4rem 0.85rem', 
                                fontSize: '0.8rem', 
                                background: filterOption === 'telegram' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                color: filterOption === 'telegram' ? 'white' : 'var(--text-main)',
                                border: '1px solid var(--border)'
                            }}
                        >
                            Telegram ({telegramCount})
                        </button>
                    </div>
                </div>

                {/* Table of Contractors */}
                {loading ? (
                    <div className="glass" style={{ padding: '3rem', textAlign: 'center', borderRadius: 'var(--radius-lg)' }}>
                        <p style={{ color: 'var(--text-muted)' }}>Cargando directorio de funcionarios y contratistas...</p>
                    </div>
                ) : (
                    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ padding: '1rem', fontWeight: 600 }}>Cédula de Ciudadanía</th>
                                        <th style={{ padding: '1rem', fontWeight: 600 }}>Funcionario / Contratista</th>
                                        <th style={{ padding: '1rem', fontWeight: 600 }}>No. Contrato</th>
                                        <th style={{ padding: '1rem', fontWeight: 600 }}>Honorarios Mensuales</th>
                                        <th style={{ padding: '1rem', fontWeight: 600 }}>Supervisor</th>
                                        <th style={{ padding: '1rem', fontWeight: 600, textAlign: 'center' }}>Telegram</th>
                                        <th style={{ padding: '1rem', fontWeight: 600, textAlign: 'center' }}>Cuentas</th>
                                        <th style={{ padding: '1rem', fontWeight: 600, textAlign: 'center' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredContractors.map((c) => {
                                        const hasValidCedula = c.cedula && !c.cedula.includes('Sin');
                                        return (
                                            <tr 
                                                key={c._id} 
                                                style={{ 
                                                    borderBottom: '1px solid var(--border)',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                {/* Cédula - Highlighted as primary identifier */}
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                        <div style={{ 
                                                            padding: '0.35rem 0.65rem', 
                                                            borderRadius: '6px', 
                                                            background: hasValidCedula ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                            color: hasValidCedula ? 'var(--primary)' : '#ef4444',
                                                            fontFamily: 'monospace',
                                                            fontWeight: 700,
                                                            fontSize: '0.9rem',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.35rem',
                                                            border: `1px solid ${hasValidCedula ? 'rgba(59, 130, 246, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                                                        }}>
                                                            <CreditCard size={14} />
                                                            {c.cedula}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Contractor Name and Email */}
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{c.contractorName || c.fullName}</div>
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.email}</div>
                                                </td>

                                                {/* Contract Number and Type */}
                                                <td style={{ padding: '1rem' }}>
                                                    {c.hasContract ? (
                                                        <>
                                                            <div style={{ fontWeight: 500 }}>{c.contractNumber}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.contractType}</div>
                                                        </>
                                                    ) : (
                                                        <span style={{ fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                                            Sin Contrato
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Monthly Value */}
                                                <td style={{ padding: '1rem', fontWeight: 600 }}>
                                                    {c.monthlyValue ? formatCurrency(c.monthlyValue) : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>-</span>}
                                                </td>

                                                {/* Supervisor */}
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ fontSize: '0.85rem' }}>{c.supervisorName}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.supervisorDependency}</div>
                                                </td>

                                                {/* Telegram Status */}
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    {c.telegramLinked ? (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500 }}>
                                                            <CheckCircle2 size={13} /> Vinculado
                                                        </span>
                                                    ) : (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem' }}>
                                                            Pendiente
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Billing accounts count */}
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{c.periodsTotal} actas</div>
                                                    <div style={{ fontSize: '0.72rem', color: c.periodsPending > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                                                        {c.periodsPending > 0 ? `${c.periodsPending} pendientes` : `${c.periodsApproved} aprobadas`}
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                                                            <button 
                                                                onClick={() => setSelectedContractor(c)}
                                                                className="btn"
                                                                title="Ver ficha detallada"
                                                                style={{ 
                                                                    padding: '0.35rem 0.65rem', 
                                                                    fontSize: '0.78rem', 
                                                                    display: 'inline-flex', 
                                                                    alignItems: 'center', 
                                                                    gap: '0.3rem',
                                                                    background: 'rgba(59, 130, 246, 0.1)',
                                                                    color: 'var(--primary)',
                                                                    border: '1px solid rgba(59, 130, 246, 0.25)',
                                                                    borderRadius: 'var(--radius-md)',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <Eye size={13} /> Detalle
                                                            </button>
                                                            <button 
                                                                onClick={() => navigate(`/admin/documents?userId=${c._id}`)}
                                                                className="btn"
                                                                title="Ver y gestionar archivos del contratista"
                                                                style={{ 
                                                                    padding: '0.35rem 0.65rem', 
                                                                    fontSize: '0.78rem', 
                                                                    display: 'inline-flex', 
                                                                    alignItems: 'center', 
                                                                    gap: '0.3rem',
                                                                    background: 'rgba(168, 85, 247, 0.1)',
                                                                    color: '#a855f7',
                                                                    border: '1px solid rgba(168, 85, 247, 0.25)',
                                                                    borderRadius: 'var(--radius-md)',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <Layers size={13} /> Archivos
                                                            </button>
                                                        <button 
                                                            onClick={(e) => handleDeleteClick(c, e)}
                                                            className="btn"
                                                            title="Eliminar usuario del sistema"
                                                            style={{ 
                                                                padding: '0.35rem 0.65rem', 
                                                                fontSize: '0.78rem', 
                                                                display: 'inline-flex', 
                                                                alignItems: 'center', 
                                                                gap: '0.3rem',
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

                                    {filteredContractors.length === 0 && (
                                        <tr>
                                            <td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                No se encontraron contratistas con los criterios de búsqueda especificados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Modal Detail for Selected Contractor */}
                <AnimatePresence>
                    {selectedContractor && (
                        <div style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.7)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            padding: '1rem'
                        }}>
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="glass"
                                style={{
                                    width: '100%',
                                    maxWidth: '650px',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '2rem',
                                    maxHeight: '90vh',
                                    overflowY: 'auto',
                                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                                    border: '1px solid var(--border)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--primary)' }}>
                                            Ficha del Funcionario / Contratista
                                        </span>
                                        <h2 style={{ fontSize: '1.4rem', margin: '0.25rem 0' }}>
                                            {selectedContractor.contractorName || selectedContractor.fullName}
                                        </h2>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontWeight: 700, fontFamily: 'monospace' }}>
                                            <CreditCard size={14} /> C.C. {selectedContractor.cedula}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedContractor(null)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Correo Electrónico</div>
                                        <div style={{ fontWeight: 500, wordBreak: 'break-all' }}>{selectedContractor.email}</div>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Teléfono / Celular</div>
                                        <div style={{ fontWeight: 500 }}>{selectedContractor.contractorPhone || 'No registrado'}</div>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Número de Contrato</div>
                                        <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{selectedContractor.contractNumber}</div>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Tipo de Contrato</div>
                                        <div style={{ fontWeight: 500 }}>{selectedContractor.contractType}</div>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Honorarios Mensuales</div>
                                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--success)' }}>
                                            {formatCurrency(selectedContractor.monthlyValue)}
                                        </div>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Valor Total del Contrato</div>
                                        <div style={{ fontWeight: 600 }}>
                                            {formatCurrency(selectedContractor.totalValue)}
                                        </div>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Supervisor y Dependencia</div>
                                        <div style={{ fontWeight: 500 }}>{selectedContractor.supervisorName}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedContractor.supervisorDependency}</div>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Entidad Bancaria</div>
                                        <div style={{ fontWeight: 500 }}>{selectedContractor.bankName || 'No registrada'}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {selectedContractor.paymentMethod ? `${selectedContractor.paymentMethod} No. ${selectedContractor.accountNumber}` : ''}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.2)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Vinculación con Telegram Bot (@CountFotmats_Bot)</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {selectedContractor.telegramLinked ? `ID de Chat: ${selectedContractor.telegramChatId}` : 'El usuario aún no ha vinculado su cuenta con /start.'}
                                        </div>
                                    </div>
                                    <span style={{ 
                                        padding: '0.35rem 0.75rem', 
                                        borderRadius: '12px', 
                                        fontSize: '0.8rem', 
                                        fontWeight: 600,
                                        background: selectedContractor.telegramLinked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                        color: selectedContractor.telegramLinked ? 'var(--success)' : '#f59e0b'
                                    }}>
                                        {selectedContractor.telegramLinked ? 'Conectado' : 'Sin Vincular'}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                    <button 
                                        className="btn" 
                                        onClick={() => {
                                            const toDelete = selectedContractor;
                                            setSelectedContractor(null);
                                            handleDeleteClick(toDelete);
                                        }}
                                        style={{ 
                                            background: 'rgba(239, 68, 68, 0.12)', 
                                            color: 'var(--error)', 
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            padding: '0.5rem 1.25rem',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            borderRadius: 'var(--radius-md)'
                                        }}
                                    >
                                        <Trash2 size={15} /> Eliminar Usuario del Sistema
                                    </button>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <button 
                                            className="btn" 
                                            onClick={() => {
                                                const userId = selectedContractor._id;
                                                setSelectedContractor(null);
                                                navigate(`/admin/documents?userId=${userId}`);
                                            }}
                                            style={{ 
                                                background: 'rgba(168, 85, 247, 0.12)', 
                                                color: '#a855f7', 
                                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                                padding: '0.5rem 1.25rem',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                borderRadius: 'var(--radius-md)'
                                            }}
                                        >
                                            <Layers size={15} /> Ver Documentos y ZIPs
                                        </button>
                                        <button 
                                            className="btn btn-primary" 
                                            onClick={() => setSelectedContractor(null)}
                                            style={{ padding: '0.5rem 1.5rem' }}
                                        >
                                            Cerrar Ficha
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Delete Confirmation Modal */}
                <AnimatePresence>
                    {userToDelete && (
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
                                    maxWidth: '480px',
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
                                    <Trash2 size={28} />
                                </div>

                                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                                    ¿Eliminar Contratista del Sistema?
                                </h3>

                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                                    Estás a punto de eliminar al usuario <strong style={{ color: 'var(--text-main)' }}>{userToDelete.contractorName || userToDelete.fullName}</strong> ({userToDelete.email}).
                                    <br />
                                    <span style={{ color: 'var(--error)', fontSize: '0.8rem', display: 'block', marginTop: '0.5rem', fontWeight: 500 }}>
                                        ⚠️ Esta acción eliminará permanentemente su cuenta, contrato registrado, actas y evidencias. No se puede deshacer.
                                    </span>
                                </p>

                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                    <button 
                                        className="btn" 
                                        onClick={() => setUserToDelete(null)}
                                        disabled={deleting}
                                        style={{ border: '1px solid var(--border)', padding: '0.6rem 1.25rem' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        className="btn" 
                                        onClick={confirmDeleteUser}
                                        disabled={deleting}
                                        style={{ 
                                            background: 'var(--error)', 
                                            color: 'white', 
                                            border: 'none', 
                                            padding: '0.6rem 1.25rem',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        {deleting ? 'Eliminando...' : 'Sí, Eliminar Usuario'}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default ContractorsList;

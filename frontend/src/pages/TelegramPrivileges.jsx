import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Shield,
    Users,
    Search,
    Plus,
    Edit3,
    Trash2,
    Copy,
    Check,
    CheckCircle2,
    AlertCircle,
    HelpCircle,
    RefreshCw,
    ToggleLeft,
    ToggleRight,
    X,
    UserCheck,
    Building2,
    Send,
    DollarSign
} from 'lucide-react';

export default function TelegramPrivileges() {
    const navigate = useNavigate();

    const [privileges, setPrivileges] = useState([]);
    const [contractors, setContractors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterScope, setFilterScope] = useState('all'); // all | exempt | provider | global | specific | active | inactive

    // Modal state for Add/Edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        telegramChatId: '',
        label: '',
        description: '',
        scope: 'all',
        operatorType: 'exempt', // exempt | provider | standard
        monthlyAccountsLimit: 15,
        preferentialRate: 20000,
        resetMonthlyUsage: false,
        assignedUsers: [],
        canRegisterFuncionarios: true,
        isActive: true
    });
    const [contractorFilter, setContractorFilter] = useState('');
    const [saving, setSaving] = useState(false);

    // Feedback alert
    const [feedback, setFeedback] = useState(null);

    // Copy to clipboard tracker
    const [copiedId, setCopiedId] = useState(null);

    // Delete modal
    const [itemToDelete, setItemToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setRefreshing(true);
        try {
            const [privRes, usersRes] = await Promise.allSettled([
                api.get('/admin/telegram-privileges'),
                api.get('/admin/users')
            ]);

            if (privRes.status === 'fulfilled') {
                setPrivileges(privRes.value.data || []);
            }
            if (usersRes.status === 'fulfilled') {
                // Filter out admin users
                const list = (usersRes.value.data || []).filter(u => u.role !== 'admin');
                setContractors(list);
            }
        } catch (error) {
            console.error('Error al cargar datos:', error);
            showFeedback('error', 'Error al sincronizar datos del servidor');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const showFeedback = (type, message) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 5000);
    };

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleOpenCreateModal = () => {
        setEditingItem(null);
        setFormData({
            telegramChatId: '',
            label: '',
            description: '',
            scope: 'all',
            operatorType: 'exempt',
            monthlyAccountsLimit: 15,
            preferentialRate: 20000,
            resetMonthlyUsage: false,
            assignedUsers: [],
            canRegisterFuncionarios: true,
            isActive: true
        });
        setContractorFilter('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (item) => {
        setEditingItem(item);
        setFormData({
            telegramChatId: item.telegramChatId || '',
            label: item.label || '',
            description: item.description || '',
            scope: item.scope || 'all',
            operatorType: item.operatorType || 'standard',
            monthlyAccountsLimit: item.monthlyAccountsLimit || 15,
            preferentialRate: item.preferentialRate || 20000,
            resetMonthlyUsage: false,
            assignedUsers: (item.assignedUsers || []).map(u => u._id || u),
            canRegisterFuncionarios: item.canRegisterFuncionarios !== false,
            isActive: item.isActive !== false
        });
        setContractorFilter('');
        setIsModalOpen(true);
    };

    const handleToggleUserSelection = (userId) => {
        setFormData(prev => {
            const current = [...prev.assignedUsers];
            const idx = current.indexOf(userId);
            if (idx > -1) {
                current.splice(idx, 1);
            } else {
                current.push(userId);
            }
            return { ...prev, assignedUsers: current };
        });
    };

    const handleSelectAllContractors = () => {
        const allIds = contractors.map(c => c._id);
        setFormData(prev => ({ ...prev, assignedUsers: allIds }));
    };

    const handleDeselectAllContractors = () => {
        setFormData(prev => ({ ...prev, assignedUsers: [] }));
    };

    const handleSubmitForm = async (e) => {
        e.preventDefault();
        if (!formData.telegramChatId.trim()) {
            showFeedback('error', 'Por favor ingresa el Telegram Chat ID');
            return;
        }
        if (!formData.label.trim()) {
            showFeedback('error', 'Por favor ingresa un nombre o alias para este operador');
            return;
        }

        if (formData.scope === 'specific' && formData.assignedUsers.length === 0) {
            showFeedback('error', 'Has seleccionado alcance específico pero no has seleccionado ningún funcionario. Por favor selecciona al menos uno o cambia a Acceso Global.');
            return;
        }

        setSaving(true);
        try {
            if (editingItem) {
                const { data } = await api.put(`/admin/telegram-privileges/${editingItem._id}`, formData);
                showFeedback('success', data.message || 'Privilegios actualizados correctamente');
            } else {
                const { data } = await api.post('/admin/telegram-privileges', formData);
                showFeedback('success', data.message || 'Operador registrado exitosamente');
            }
            setIsModalOpen(false);
            await loadData();
        } catch (error) {
            console.error('Error al guardar privilegios:', error);
            showFeedback('error', error.response?.data?.message || 'Error al guardar privilegios');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (item, e) => {
        if (e) e.stopPropagation();
        try {
            const { data } = await api.patch(`/admin/telegram-privileges/${item._id}/toggle`);
            setPrivileges(prev => prev.map(p => p._id === item._id ? { ...p, isActive: data.isActive } : p));
            showFeedback('success', data.message);
        } catch (error) {
            console.error('Error al cambiar estado:', error);
            showFeedback('error', 'No se pudo cambiar el estado');
        }
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        setDeleting(true);
        try {
            const { data } = await api.delete(`/admin/telegram-privileges/${itemToDelete._id}`);
            showFeedback('success', data.message || 'Privilegio eliminado con éxito');
            setItemToDelete(null);
            await loadData();
        } catch (error) {
            console.error('Error al eliminar:', error);
            showFeedback('error', error.response?.data?.message || 'Error al eliminar');
        } finally {
            setDeleting(false);
        }
    };

    // Filter privileges
    const filteredPrivileges = privileges.filter(p => {
        const matchesSearch =
            (p.label || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.telegramChatId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.description || '').toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        if (filterScope === 'exempt') return p.operatorType === 'exempt';
        if (filterScope === 'provider') return p.operatorType === 'provider';
        if (filterScope === 'global') return p.scope === 'all';
        if (filterScope === 'specific') return p.scope === 'specific';
        if (filterScope === 'active') return p.isActive;
        if (filterScope === 'inactive') return !p.isActive;
        return true;
    });

    // KPI counts
    const totalCount = privileges.length;
    const activeCount = privileges.filter(p => p.isActive).length;
    const exemptCount = privileges.filter(p => p.operatorType === 'exempt').length;
    const providerCount = privileges.filter(p => p.operatorType === 'provider').length;
    const globalCount = privileges.filter(p => p.scope === 'all').length;
    const specificCount = privileges.filter(p => p.scope === 'specific').length;

    // Filter contractors inside modal
    const modalFilteredContractors = contractors.filter(c => {
        const query = contractorFilter.toLowerCase();
        return (
            (c.fullName || '').toLowerCase().includes(query) ||
            (c.cedula || '').toLowerCase().includes(query) ||
            (c.entityName || '').toLowerCase().includes(query) ||
            (c.email || '').toLowerCase().includes(query)
        );
    });

    return (
        <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--text-main)', padding: '2rem 0' }}>
            <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                
                {/* ── Back Navigation ─────────────────────────────────── */}
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
                        borderRadius: 'var(--radius-md)'
                    }}
                >
                    <ArrowLeft size={16} />
                    Volver al Panel Maestro
                </button>

                {/* ── Feedback Notification ───────────────────────────── */}
                <AnimatePresence>
                    {feedback && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            style={{
                                padding: '1rem 1.25rem',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                border: `1px solid ${feedback.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
                                color: feedback.type === 'success' ? 'var(--success)' : 'var(--error)',
                                fontSize: '0.9rem'
                            }}
                        >
                            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            <span style={{ fontWeight: 500 }}>{feedback.message}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Header Title & Actions ───────────────────────────── */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    marginBottom: '2rem'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.8rem',
                                color: 'var(--primary)',
                                fontWeight: 700,
                                background: 'rgba(37, 99, 235, 0.12)',
                                padding: '0.2rem 0.6rem',
                                borderRadius: 'var(--radius-sm)'
                            }}>
                                <Shield size={14} /> Módulo de Seguridad y Accesos
                            </span>
                        </div>
                        <h1 style={{ fontSize: '2rem', margin: '0 0 0.4rem 0', fontWeight: 800, letterSpacing: '-0.02em' }}>
                            Privilegios Telegram (Gestión Multicuenta)
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0, maxWidth: '750px' }}>
                            Autoriza IDs de Telegram para operar y gestionar cuentas de cobro de múltiples funcionarios o contratistas desde un solo chat de Telegram.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={loadData}
                            disabled={refreshing}
                            className="btn"
                            style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-main)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.6rem 1rem'
                            }}
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                            <span>Sincronizar</span>
                        </button>
                        <button
                            onClick={handleOpenCreateModal}
                            className="btn btn-primary"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.6rem 1.25rem',
                                fontWeight: 600,
                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                            }}
                        >
                            <Plus size={18} />
                            <span>Nuevo Operador Telegram</span>
                        </button>
                    </div>
                </div>

                {/* ── Instructional Guide Card ─────────────────────────── */}
                <div className="glass" style={{
                    padding: '1.5rem',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: '2rem',
                    borderLeft: '4px solid var(--primary)',
                    background: 'rgba(37, 99, 235, 0.04)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <HelpCircle size={18} color="var(--primary)" />
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                            ¿Cómo funciona la gestión multicuenta de Telegram?
                        </h3>
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '1rem',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        lineHeight: 1.5
                    }}>
                        <div style={{ background: 'var(--surface)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>1. Obtener ID de Telegram</div>
                            El funcionario o asistente abre el bot en Telegram y envía el comando <code style={{ color: 'var(--primary)', fontWeight: 700 }}>/id</code>. El bot le responderá su ID numérico inmediatamente.
                        </div>
                        <div style={{ background: 'var(--surface)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>2. Registrar el ID aquí</div>
                            Pulsa <strong>"Nuevo Operador Telegram"</strong>, pega el ID y elige si tendrá <strong>Acceso Global</strong> (a cualquier contratista) o a <strong>Funcionarios Específicos</strong>.
                        </div>
                        <div style={{ background: 'var(--surface)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>3. Cambio de Funcionario en 1 Click</div>
                            Desde Telegram, el operador podrá escribir <code style={{ color: 'var(--primary)', fontWeight: 700 }}>/funcionario</code> o presionar el botón <strong>"Cambiar Funcionario"</strong> para tramitar cobros de diferentes personas sin cerrar sesión.
                        </div>
                    </div>
                </div>

                {/* ── KPI Stats Grid ───────────────────────────────────── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1.25rem',
                    marginBottom: '2rem'
                }}>
                    <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Operadores</div>
                        <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '0.25rem' }}>{totalCount}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cuentas de Telegram registradas</div>
                    </div>
                    <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #10b981' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Exentos (Sin Costo)</div>
                        <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>{exemptCount}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Trámites 100% gratuitos</div>
                    </div>
                    <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #3b82f6' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Proveedores con Cupo</div>
                        <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.25rem' }}>{providerCount}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tarifa preferencial / mes</div>
                    </div>
                    <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--accent)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Operadores Activos</div>
                        <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--accent)', marginTop: '0.25rem' }}>{activeCount}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Con permisos habilitados</div>
                    </div>
                </div>

                {/* ── Search & Filter Bar ─────────────────────────────── */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    marginBottom: '1.5rem'
                }}>
                    <div style={{ position: 'relative', flex: '1', minWidth: '260px', maxWidth: '450px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, Telegram ID o nota..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.65rem 1rem 0.65rem 2.4rem',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-main)',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[
                            { key: 'all', label: `Todos (${totalCount})` },
                            { key: 'exempt', label: `Exentos (${exemptCount})` },
                            { key: 'provider', label: `Proveedores (${providerCount})` },
                            { key: 'active', label: `Activos (${activeCount})` },
                            { key: 'global', label: `Acceso Maestro (${globalCount})` }
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilterScope(f.key)}
                                className="btn"
                                style={{
                                    fontSize: '0.825rem',
                                    padding: '0.45rem 0.85rem',
                                    background: filterScope === f.key ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                                    color: filterScope === f.key ? 'white' : 'var(--text-main)',
                                    border: '1px solid var(--border)'
                                }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Operators Table / Cards ─────────────────────────── */}
                <div className="glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                    {loading ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
                            <p>Cargando operadores autorizados de Telegram...</p>
                        </div>
                    ) : filteredPrivileges.length === 0 ? (
                        <div style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
                            <div style={{
                                width: '60px',
                                height: '60px',
                                borderRadius: '50%',
                                background: 'rgba(37, 99, 235, 0.1)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.25rem'
                            }}>
                                <Users size={30} />
                            </div>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: 700 }}>
                                {searchTerm ? 'No se encontraron operadores que coincidan con la búsqueda' : 'No hay operadores de Telegram autorizados todavía'}
                            </h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
                                Registra el ID de Telegram de asistentes, secretarias o funcionarios para que puedan gestionar múltiples cuentas de cobro desde un solo chat.
                            </p>
                            <button
                                onClick={handleOpenCreateModal}
                                className="btn btn-primary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem' }}
                            >
                                <Plus size={18} />
                                <span>Registrar Primer Operador</span>
                            </button>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Operador / Alias</th>
                                        <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Telegram Chat ID</th>
                                        <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Modalidad & Cupo</th>
                                        <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Alcance de Gestión</th>
                                        <th style={{ padding: '1rem 1.25rem', fontWeight: 600, textAlign: 'center' }}>Estado</th>
                                        <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Última Actividad</th>
                                        <th style={{ padding: '1rem 1.25rem', fontWeight: 600, textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPrivileges.map((item) => {
                                        const isCopied = copiedId === item._id;
                                        return (
                                            <tr key={item._id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                                                
                                                {/* Operador / Alias */}
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                                        <div style={{
                                                            width: '36px',
                                                            height: '36px',
                                                            borderRadius: '50%',
                                                            background: item.isActive ? 'rgba(37, 99, 235, 0.12)' : 'rgba(156, 163, 175, 0.1)',
                                                            color: item.isActive ? 'var(--primary)' : 'var(--text-muted)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontWeight: 700,
                                                            fontSize: '0.85rem'
                                                        }}>
                                                            {item.label ? item.label.charAt(0).toUpperCase() : 'T'}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.label}</div>
                                                            {item.description && (
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.description}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Telegram Chat ID */}
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <code style={{
                                                            background: 'rgba(255, 255, 255, 0.06)',
                                                            padding: '0.25rem 0.6rem',
                                                            borderRadius: 'var(--radius-sm)',
                                                            fontFamily: 'monospace',
                                                            fontSize: '0.85rem',
                                                            fontWeight: 600,
                                                            color: 'var(--primary)'
                                                        }}>
                                                            {item.telegramChatId}
                                                        </code>
                                                        <button
                                                            onClick={() => copyToClipboard(item.telegramChatId, item._id)}
                                                            className="btn"
                                                            title="Copiar Telegram ID"
                                                            style={{
                                                                padding: '0.3rem',
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: isCopied ? 'var(--success)' : 'var(--text-muted)',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Modalidad & Cupo */}
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    {item.operatorType === 'exempt' ? (
                                                        <div>
                                                            <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                padding: '0.25rem 0.65rem',
                                                                borderRadius: '999px',
                                                                background: 'rgba(16, 185, 129, 0.12)',
                                                                color: '#10b981',
                                                                fontSize: '0.78rem',
                                                                fontWeight: 700
                                                            }}>
                                                                Exento (Sin Costo)
                                                            </span>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                                Trámites gratuitos
                                                            </div>
                                                        </div>
                                                    ) : item.operatorType === 'provider' ? (
                                                        <div>
                                                            <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                padding: '0.25rem 0.65rem',
                                                                borderRadius: '999px',
                                                                background: 'rgba(59, 130, 246, 0.12)',
                                                                color: 'var(--primary)',
                                                                fontSize: '0.78rem',
                                                                fontWeight: 700
                                                            }}>
                                                                Proveedor Preferencial
                                                            </span>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                                                                Cupo: {item.accountsUsedThisMonth || 0} / {item.monthlyAccountsLimit || 15} al mes
                                                            </div>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                                Tarifa: ${Number(item.preferentialRate || 20000).toLocaleString('es-CO')}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                padding: '0.25rem 0.65rem',
                                                                borderRadius: '999px',
                                                                background: 'rgba(255, 255, 255, 0.06)',
                                                                color: 'var(--text-muted)',
                                                                fontSize: '0.78rem',
                                                                fontWeight: 600
                                                            }}>
                                                                Estándar
                                                            </span>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                                Acta 1 gratis, Acta 2+ paga
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Alcance de Gestión */}
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    {item.scope === 'all' ? (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            padding: '0.25rem 0.65rem',
                                                            borderRadius: '999px',
                                                            background: 'rgba(139, 92, 246, 0.12)',
                                                            color: '#8b5cf6',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700
                                                        }}>
                                                            Acceso Maestro (Todos los funcionarios)
                                                        </span>
                                                    ) : (
                                                        <div>
                                                            <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.35rem',
                                                                padding: '0.25rem 0.65rem',
                                                                borderRadius: '999px',
                                                                background: 'rgba(245, 158, 11, 0.12)',
                                                                color: 'var(--accent)',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                                marginBottom: '0.35rem'
                                                            }}>
                                                                <Users size={12} />
                                                                Específico: {item.assignedUsers?.length || 0} funcionarios
                                                            </span>
                                                            {item.assignedUsers && item.assignedUsers.length > 0 && (
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', maxWidth: '350px' }}>
                                                                    {item.assignedUsers.slice(0, 3).map((u, i) => (
                                                                        <span key={i} style={{
                                                                            fontSize: '0.7rem',
                                                                            background: 'rgba(255, 255, 255, 0.05)',
                                                                            padding: '0.15rem 0.45rem',
                                                                            borderRadius: '4px',
                                                                            color: 'var(--text-muted)'
                                                                        }}>
                                                                            {u.fullName || 'Usuario'}
                                                                        </span>
                                                                    ))}
                                                                    {item.assignedUsers.length > 3 && (
                                                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                                            +{item.assignedUsers.length - 3} más
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Estado */}
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                                                    <button
                                                        onClick={(e) => handleToggleActive(item, e)}
                                                        className="btn"
                                                        title={item.isActive ? 'Hacer clic para pausar acceso' : 'Hacer clic para activar acceso'}
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: 'var(--radius-sm)'
                                                        }}
                                                    >
                                                        {item.isActive ? (
                                                            <span style={{
                                                                color: 'var(--success)',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.3rem',
                                                                fontWeight: 600,
                                                                fontSize: '0.8rem',
                                                                background: 'rgba(16, 185, 129, 0.1)',
                                                                padding: '0.25rem 0.65rem',
                                                                borderRadius: '12px'
                                                            }}>
                                                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)' }}></span>
                                                                Activo
                                                            </span>
                                                        ) : (
                                                            <span style={{
                                                                color: 'var(--text-muted)',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.3rem',
                                                                fontWeight: 600,
                                                                fontSize: '0.8rem',
                                                                background: 'rgba(255, 255, 255, 0.05)',
                                                                padding: '0.25rem 0.65rem',
                                                                borderRadius: '12px'
                                                            }}>
                                                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--text-muted)' }}></span>
                                                                Inactivo
                                                            </span>
                                                        )}
                                                    </button>
                                                </td>

                                                {/* Última Actividad */}
                                                <td style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                    {item.lastActiveAt ? (
                                                        <span>{new Date(item.lastActiveAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                    ) : (
                                                        <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Sin actividad aún</span>
                                                    )}
                                                </td>

                                                {/* Acciones */}
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <button
                                                            onClick={() => handleOpenEditModal(item)}
                                                            className="btn"
                                                            title="Editar privilegios y funcionarios"
                                                            style={{
                                                                padding: '0.45rem',
                                                                background: 'rgba(255, 255, 255, 0.05)',
                                                                border: '1px solid var(--border)',
                                                                color: 'var(--text-main)',
                                                                borderRadius: 'var(--radius-sm)'
                                                            }}
                                                        >
                                                            <Edit3 size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => setItemToDelete(item)}
                                                            className="btn"
                                                            title="Eliminar privilegios"
                                                            style={{
                                                                padding: '0.45rem',
                                                                background: 'rgba(239, 68, 68, 0.1)',
                                                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                                                color: 'var(--error)',
                                                                borderRadius: 'var(--radius-sm)'
                                                            }}
                                                        >
                                                            <Trash2 size={15} />
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

                {/* ── Modal Add / Edit Operator ───────────────────────── */}
                <AnimatePresence>
                    {isModalOpen && (
                        <div style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.75)',
                            backdropFilter: 'blur(5px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 100,
                            padding: '1.5rem'
                        }}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                style={{
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-lg)',
                                    width: '100%',
                                    maxWidth: '680px',
                                    maxHeight: '90vh',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    boxShadow: 'var(--shadow-xl)',
                                    overflow: 'hidden'
                                }}
                            >
                                {/* Modal Header */}
                                <div style={{
                                    padding: '1.25rem 1.5rem',
                                    borderBottom: '1px solid var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'rgba(255, 255, 255, 0.02)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                        <div style={{
                                            padding: '0.5rem',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'rgba(37, 99, 235, 0.1)',
                                            color: 'var(--primary)'
                                        }}>
                                            <Shield size={20} />
                                        </div>
                                        <div>
                                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                                                {editingItem ? 'Editar Privilegios de Telegram' : 'Registrar Nuevo Operador Telegram'}
                                            </h2>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                Asigna permisos para gestionar múltiples cuentas de cobro desde un chat
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="btn"
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '0.25rem' }}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Modal Body Form */}
                                <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
                                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        
                                        {/* Telegram Chat ID */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                                Telegram Chat ID <span style={{ color: 'var(--error)' }}>*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Ej: 6382910482"
                                                value={formData.telegramChatId}
                                                onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value.replace(/\s+/g, '') })}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.65rem 0.85rem',
                                                    background: 'var(--background)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: 'var(--text-main)',
                                                    fontSize: '0.9rem',
                                                    fontFamily: 'monospace'
                                                }}
                                            />
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                                El usuario puede averiguar su ID escribiéndole al bot el comando <code style={{ color: 'var(--primary)' }}>/id</code>
                                            </div>
                                        </div>

                                        {/* Label / Alias */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                                Nombre o Alias del Operador <span style={{ color: 'var(--error)' }}>*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Ej: Paola Gómez - Gestión Cuentas"
                                                value={formData.label}
                                                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.65rem 0.85rem',
                                                    background: 'var(--background)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: 'var(--text-main)',
                                                    fontSize: '0.9rem'
                                                }}
                                            />
                                        </div>

                                        {/* Description / Dependency */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                                Dependencia o Notas (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Ej: Secretaría de Educación / Apoyo Administrativo"
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.65rem 0.85rem',
                                                    background: 'var(--background)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: 'var(--text-main)',
                                                    fontSize: '0.9rem'
                                                }}
                                            />
                                        </div>

                                        {/* Modalidad de Cobro y Beneficios */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                                Modalidad y Esquema de Cobro
                                            </label>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                                
                                                {/* Exento */}
                                                <div
                                                    onClick={() => setFormData({ ...formData, operatorType: 'exempt' })}
                                                    style={{
                                                        padding: '0.9rem',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: `2px solid ${formData.operatorType === 'exempt' ? '#10b981' : 'var(--border)'}`,
                                                        background: formData.operatorType === 'exempt' ? 'rgba(16, 185, 129, 0.08)' : 'var(--background)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.3rem', color: formData.operatorType === 'exempt' ? '#10b981' : 'inherit' }}>
                                                        <input
                                                            type="radio"
                                                            name="operatorType"
                                                            checked={formData.operatorType === 'exempt'}
                                                            onChange={() => setFormData({ ...formData, operatorType: 'exempt' })}
                                                        />
                                                        <span>Exento (Sin Costo)</span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                                                        100% gratuito. Puede tramitar cuentas ilimitadas sin pago alguno.
                                                    </p>
                                                </div>

                                                {/* Proveedor */}
                                                <div
                                                    onClick={() => setFormData({ ...formData, operatorType: 'provider' })}
                                                    style={{
                                                        padding: '0.9rem',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: `2px solid ${formData.operatorType === 'provider' ? 'var(--primary)' : 'var(--border)'}`,
                                                        background: formData.operatorType === 'provider' ? 'rgba(37, 99, 235, 0.08)' : 'var(--background)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.3rem', color: formData.operatorType === 'provider' ? 'var(--primary)' : 'inherit' }}>
                                                        <input
                                                            type="radio"
                                                            name="operatorType"
                                                            checked={formData.operatorType === 'provider'}
                                                            onChange={() => setFormData({ ...formData, operatorType: 'provider' })}
                                                        />
                                                        <span>Proveedor / Tramitador</span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                                                        Tarifa preferencial con cupo mensual de cuentas definido.
                                                    </p>
                                                </div>

                                                {/* Estándar */}
                                                <div
                                                    onClick={() => setFormData({ ...formData, operatorType: 'standard' })}
                                                    style={{
                                                        padding: '0.9rem',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: `2px solid ${formData.operatorType === 'standard' ? 'var(--accent)' : 'var(--border)'}`,
                                                        background: formData.operatorType === 'standard' ? 'rgba(245, 158, 11, 0.08)' : 'var(--background)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.3rem', color: formData.operatorType === 'standard' ? 'var(--accent)' : 'inherit' }}>
                                                        <input
                                                            type="radio"
                                                            name="operatorType"
                                                            checked={formData.operatorType === 'standard'}
                                                            onChange={() => setFormData({ ...formData, operatorType: 'standard' })}
                                                        />
                                                        <span>Estándar</span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                                                        1ª cuenta gratis. A partir de la 2ª cuenta exige pago para evidencias.
                                                    </p>
                                                </div>

                                            </div>
                                        </div>

                                        {/* Provider Parameters (if provider) */}
                                        {formData.operatorType === 'provider' && (
                                            <div style={{
                                                background: 'rgba(37, 99, 235, 0.06)',
                                                border: '1px solid rgba(37, 99, 235, 0.25)',
                                                borderRadius: 'var(--radius-md)',
                                                padding: '1rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.85rem'
                                            }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary)' }}>
                                                    Configuración del Paquete Mensual de Proveedor
                                                </div>
                                                
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                                            Cupo Mensual de Cuentas: <strong style={{ color: 'var(--primary)' }}>{formData.monthlyAccountsLimit} cuentas</strong>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="500"
                                                            value={formData.monthlyAccountsLimit}
                                                            onChange={(e) => setFormData({ ...formData, monthlyAccountsLimit: parseInt(e.target.value) || 15 })}
                                                            style={{
                                                                width: '100%',
                                                                padding: '0.5rem 0.75rem',
                                                                background: 'var(--background)',
                                                                border: '1px solid var(--border)',
                                                                borderRadius: 'var(--radius-sm)',
                                                                color: 'var(--text-main)',
                                                                fontSize: '0.85rem'
                                                            }}
                                                        />
                                                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                                                            {[10, 15, 20, 30].map(n => (
                                                                <button
                                                                    type="button"
                                                                    key={n}
                                                                    onClick={() => setFormData({ ...formData, monthlyAccountsLimit: n })}
                                                                    className="btn"
                                                                    style={{
                                                                        fontSize: '0.72rem',
                                                                        padding: '0.2rem 0.5rem',
                                                                        background: formData.monthlyAccountsLimit === n ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                                                                        color: formData.monthlyAccountsLimit === n ? 'white' : 'var(--text-muted)',
                                                                        borderRadius: '4px'
                                                                    }}
                                                                >
                                                                    {n} al mes
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                                            Tarifa Preferencial por Cuenta (COP)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="1000"
                                                            min="0"
                                                            value={formData.preferentialRate}
                                                            onChange={(e) => setFormData({ ...formData, preferentialRate: parseInt(e.target.value) || 0 })}
                                                            style={{
                                                                width: '100%',
                                                                padding: '0.5rem 0.75rem',
                                                                background: 'var(--background)',
                                                                border: '1px solid var(--border)',
                                                                borderRadius: 'var(--radius-sm)',
                                                                color: 'var(--text-main)',
                                                                fontSize: '0.85rem'
                                                            }}
                                                        />
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.45rem' }}>
                                                            Tarifa: <strong>${Number(formData.preferentialRate || 0).toLocaleString('es-CO')} COP</strong> por cuenta
                                                        </div>
                                                    </div>
                                                </div>

                                                {editingItem && (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                            Consumo este ciclo ({editingItem.currentMonthCycle || 'Mes actual'}): <strong>{editingItem.accountsUsedThisMonth || 0}</strong> de <strong>{editingItem.monthlyAccountsLimit || 15}</strong> cuentas
                                                        </div>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', cursor: 'pointer', color: 'var(--primary)' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={Boolean(formData.resetMonthlyUsage)}
                                                                onChange={(e) => setFormData({ ...formData, resetMonthlyUsage: e.target.checked })}
                                                            />
                                                            <span>Reiniciar consumo del mes a 0</span>
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Scope Selector */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                                Alcance de Privilegios de Gestión
                                            </label>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                <div
                                                    onClick={() => setFormData({ ...formData, scope: 'all' })}
                                                    style={{
                                                        padding: '1rem',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: `2px solid ${formData.scope === 'all' ? 'var(--primary)' : 'var(--border)'}`,
                                                        background: formData.scope === 'all' ? 'rgba(37, 99, 235, 0.08)' : 'var(--background)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                                                        <input
                                                            type="radio"
                                                            checked={formData.scope === 'all'}
                                                            onChange={() => setFormData({ ...formData, scope: 'all' })}
                                                        />
                                                        <span>Acceso Global (Maestro)</span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                                        Puede buscar y gestionar cuentas de cobro de <strong>cualquier contratista o funcionario</strong> registrado en el sistema.
                                                    </p>
                                                </div>

                                                <div
                                                    onClick={() => setFormData({ ...formData, scope: 'specific' })}
                                                    style={{
                                                        padding: '1rem',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: `2px solid ${formData.scope === 'specific' ? 'var(--accent)' : 'var(--border)'}`,
                                                        background: formData.scope === 'specific' ? 'rgba(245, 158, 11, 0.08)' : 'var(--background)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                                                        <input
                                                            type="radio"
                                                            checked={formData.scope === 'specific'}
                                                            onChange={() => setFormData({ ...formData, scope: 'specific' })}
                                                        />
                                                        <span>Funcionarios Específicos</span>
                                                    </div>
                                                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                                        Restringido <strong>únicamente a los funcionarios que marques</strong> en la lista a continuación.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Specific Contractors Selection List */}
                                        {formData.scope === 'specific' && (
                                            <div style={{
                                                background: 'var(--background)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 'var(--radius-md)',
                                                padding: '1rem'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                                                        Funcionarios Autorizados ({formData.assignedUsers.length} seleccionados)
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            type="button"
                                                            onClick={handleSelectAllContractors}
                                                            className="btn"
                                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                                        >
                                                            Marcar Todos
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleDeselectAllContractors}
                                                            className="btn"
                                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                                        >
                                                            Desmarcar
                                                        </button>
                                                    </div>
                                                </div>

                                                <input
                                                    type="text"
                                                    placeholder="Filtrar por nombre o cédula..."
                                                    value={contractorFilter}
                                                    onChange={(e) => setContractorFilter(e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.45rem 0.75rem',
                                                        background: 'var(--surface)',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        color: 'var(--text-main)',
                                                        fontSize: '0.8rem',
                                                        marginBottom: '0.75rem'
                                                    }}
                                                />

                                                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                    {modalFilteredContractors.length === 0 ? (
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                                                            No se encontraron funcionarios disponibles
                                                        </div>
                                                    ) : (
                                                        modalFilteredContractors.map(c => {
                                                            const isChecked = formData.assignedUsers.includes(c._id);
                                                            return (
                                                                <label
                                                                    key={c._id}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.65rem',
                                                                        padding: '0.5rem 0.75rem',
                                                                        borderRadius: 'var(--radius-sm)',
                                                                        background: isChecked ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                                                                        cursor: 'pointer',
                                                                        fontSize: '0.825rem'
                                                                    }}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => handleToggleUserSelection(c._id)}
                                                                    />
                                                                    <div style={{ flex: 1 }}>
                                                                        <span style={{ fontWeight: 600 }}>{c.fullName}</span>
                                                                        <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                                                            (C.C. {c.cedula || 'Sin cédula'})
                                                                        </span>
                                                                    </div>
                                                                    <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                                                        {c.entityName || 'Alcaldía'}
                                                                    </span>
                                                                </label>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Status Checkboxes */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.canRegisterFuncionarios}
                                                    onChange={(e) => setFormData({ ...formData, canRegisterFuncionarios: e.target.checked })}
                                                />
                                                <span>Permitir registrar nuevos contratos y funcionarios desde Telegram</span>
                                            </label>

                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.isActive}
                                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                                />
                                                <span>Operador Activo (Habilitar acceso inmediatamente)</span>
                                            </label>
                                        </div>

                                    </div>

                                    {/* Modal Footer Actions */}
                                    <div style={{
                                        padding: '1.25rem 1.5rem',
                                        borderTop: '1px solid var(--border)',
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        gap: '0.75rem',
                                        background: 'rgba(255, 255, 255, 0.02)'
                                    }}>
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="btn"
                                            disabled={saving}
                                            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="btn btn-primary"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                                        >
                                            {saving ? (
                                                <>
                                                    <RefreshCw size={16} className="animate-spin" />
                                                    <span>Guardando...</span>
                                                </>
                                            ) : (
                                                <span>{editingItem ? 'Actualizar Privilegios' : 'Guardar y Autorizar'}</span>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* ── Modal Delete Confirmation ──────────────────────── */}
                <AnimatePresence>
                    {itemToDelete && (
                        <div style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.75)',
                            backdropFilter: 'blur(5px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 100,
                            padding: '1.5rem'
                        }}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                style={{
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-lg)',
                                    width: '100%',
                                    maxWidth: '480px',
                                    padding: '1.75rem',
                                    boxShadow: 'var(--shadow-xl)'
                                }}
                            >
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    color: 'var(--error)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '1rem'
                                }}>
                                    <Trash2 size={24} />
                                </div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                                    ¿Revocar privilegios de Telegram?
                                </h3>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
                                    Estás a punto de revocar todos los privilegios de operador multicuenta para <strong>"{itemToDelete.label}"</strong> (ID: {itemToDelete.telegramChatId}). Esta cuenta ya no podrá tramitar cuentas de cobro de múltiples funcionarios desde Telegram.
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                    <button
                                        onClick={() => setItemToDelete(null)}
                                        disabled={deleting}
                                        className="btn"
                                        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="btn"
                                        style={{ background: 'var(--error)', color: 'white', fontWeight: 600 }}
                                    >
                                        {deleting ? 'Eliminando...' : 'Sí, Revocar Privilegios'}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
}

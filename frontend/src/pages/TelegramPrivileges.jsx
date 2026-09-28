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
    DollarSign,
    CreditCard,
    CheckCircle,
    XCircle,
    Eye,
    ExternalLink,
    Receipt,
    Smartphone,
    Building,
    Clock,
    Sliders,
    FileText,
    CheckCheck,
    Download
} from 'lucide-react';

export default function TelegramPrivileges() {
    const navigate = useNavigate();

    // Tabs: 'operators' | 'payments'
    const [activeTab, setActiveTab] = useState('operators');

    const [privileges, setPrivileges] = useState([]);
    const [contractors, setContractors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterScope, setFilterScope] = useState('all'); // all | exempt | provider | global | specific | active | inactive

    // Payment Config state
    const [paymentConfig, setPaymentConfig] = useState({
        approvalTelegramChatId: '',
        approvalTelegramChatIds: [],
        contractorRate: 60000,
        packageRate: 100000,
        packageAccountsCount: 5,
        packageUnitRate: 20000,
        paymentInstructions: {
            bankName: 'Bancolombia',
            accountNumber: '',
            accountType: 'Ahorros',
            nequiNumber: '',
            daviplataNumber: '',
            accountHolderName: '',
            accountHolderId: '',
            instructionsText: ''
        }
    });
    const [savingConfig, setSavingConfig] = useState(false);

    // Payment Receipts state
    const [payments, setPayments] = useState([]);
    const [paymentFilterStatus, setPaymentFilterStatus] = useState('all'); // all | pending | approved | rejected
    const [paymentSearch, setPaymentSearch] = useState('');
    const [selectedReceiptForModal, setSelectedReceiptForModal] = useState(null);
    const [rejectModalPayment, setRejectModalPayment] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState(null);

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
            const [privRes, usersRes, configRes, paymentsRes] = await Promise.allSettled([
                api.get('/admin/telegram-privileges'),
                api.get('/admin/users'),
                api.get('/admin/payment-config'),
                api.get('/admin/payments')
            ]);

            if (privRes.status === 'fulfilled') {
                setPrivileges(privRes.value.data || []);
            }
            if (usersRes.status === 'fulfilled') {
                const list = (usersRes.value.data || []).filter(u => u.role !== 'admin');
                setContractors(list);
            }
            if (configRes.status === 'fulfilled' && configRes.value.data) {
                const cfg = configRes.value.data;
                setPaymentConfig(prev => ({
                    ...prev,
                    ...cfg,
                    paymentInstructions: {
                        ...prev.paymentInstructions,
                        ...(cfg.paymentInstructions || {})
                    }
                }));
            }
            if (paymentsRes.status === 'fulfilled') {
                setPayments(paymentsRes.value.data || []);
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

    // Payment Config Handlers
    const handleSavePaymentConfig = async (e) => {
        if (e) e.preventDefault();
        setSavingConfig(true);
        try {
            const { data } = await api.put('/admin/payment-config', paymentConfig);
            if (data.config) {
                setPaymentConfig(prev => ({
                    ...prev,
                    ...data.config,
                    paymentInstructions: {
                        ...prev.paymentInstructions,
                        ...(data.config.paymentInstructions || {})
                    }
                }));
            }
            showFeedback('success', data.message || 'Configuración de pagos actualizada exitosamente');
        } catch (error) {
            console.error('Error al guardar configuración de pagos:', error);
            showFeedback('error', error.response?.data?.message || 'Error al guardar configuración de pagos');
        } finally {
            setSavingConfig(false);
        }
    };

    const handleApprovePayment = async (paymentId) => {
        setActionLoadingId(paymentId);
        try {
            const { data } = await api.patch(`/admin/payments/${paymentId}/approve`, {});
            showFeedback('success', data.message || 'Pago aprobado exitosamente. Se ha notificado al contratista por Telegram.');
            setPayments(prev => prev.map(p => p._id === paymentId ? { ...p, status: 'approved', approvedAt: new Date(), approvedBy: 'Administrador' } : p));
            if (selectedReceiptForModal && selectedReceiptForModal._id === paymentId) {
                setSelectedReceiptForModal(prev => ({ ...prev, status: 'approved', approvedAt: new Date(), approvedBy: 'Administrador' }));
            }
        } catch (error) {
            console.error('Error al aprobar pago:', error);
            showFeedback('error', error.response?.data?.message || 'Error al aprobar pago');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleConfirmRejectPayment = async () => {
        if (!rejectModalPayment) return;
        setActionLoadingId(rejectModalPayment._id);
        try {
            const { data } = await api.patch(`/admin/payments/${rejectModalPayment._id}/reject`, { reason: rejectionReason });
            showFeedback('success', data.message || 'Pago rechazado exitosamente. Se ha notificado al contratista.');
            setPayments(prev => prev.map(p => p._id === rejectModalPayment._id ? { ...p, status: 'rejected', rejectionReason } : p));
            if (selectedReceiptForModal && selectedReceiptForModal._id === rejectModalPayment._id) {
                setSelectedReceiptForModal(prev => ({ ...prev, status: 'rejected', rejectionReason }));
            }
            setRejectModalPayment(null);
            setRejectionReason('');
        } catch (error) {
            console.error('Error al rechazar pago:', error);
            showFeedback('error', error.response?.data?.message || 'Error al rechazar pago');
        } finally {
            setActionLoadingId(null);
        }
    };

    // Payment KPI counts & filtering
    const pendingPaymentsCount = payments.filter(p => p.status === 'pending').length;
    const approvedPaymentsCount = payments.filter(p => p.status === 'approved').length;
    const rejectedPaymentsCount = payments.filter(p => p.status === 'rejected').length;

    const filteredPayments = payments.filter(p => {
        if (paymentFilterStatus !== 'all' && p.status !== paymentFilterStatus) {
            return false;
        }
        if (paymentSearch.trim()) {
            const q = paymentSearch.toLowerCase();
            const matchesName = (p.contractorName || p.user?.fullName || '').toLowerCase().includes(q);
            const matchesCedula = (p.cedula || '').toLowerCase().includes(q);
            const matchesChatId = (p.telegramChatId || '').toLowerCase().includes(q);
            const matchesUsername = (p.telegramUsername || '').toLowerCase().includes(q);
            const matchesContract = (p.contract?.contractNumber || '').toLowerCase().includes(q);
            if (!matchesName && !matchesCedula && !matchesChatId && !matchesUsername && !matchesContract) {
                return false;
            }
        }
        return true;
    });

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
                        {activeTab === 'operators' ? (
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
                        ) : (
                            <button
                                onClick={handleSavePaymentConfig}
                                disabled={savingConfig}
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
                                <Sliders size={18} />
                                <span>{savingConfig ? 'Guardando...' : 'Guardar Configuración'}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Main Section Tabs ───────────────────────────── */}
                <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    borderBottom: '1px solid var(--border)',
                    marginBottom: '2rem',
                    paddingBottom: '0.5rem',
                    flexWrap: 'wrap'
                }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('operators')}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '0.65rem 1.25rem',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: activeTab === 'operators' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                            color: activeTab === 'operators' ? 'white' : 'var(--text-main)',
                            fontWeight: 700,
                            fontSize: '0.925rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Users size={18} />
                        Operadores Multicuenta
                        <span style={{
                            background: activeTab === 'operators' ? 'rgba(255, 255, 255, 0.25)' : 'var(--surface)',
                            color: activeTab === 'operators' ? 'white' : 'var(--text-muted)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 800
                        }}>
                            {totalCount}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('payments')}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '0.65rem 1.25rem',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: activeTab === 'payments' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                            color: activeTab === 'payments' ? 'white' : 'var(--text-main)',
                            fontWeight: 700,
                            fontSize: '0.925rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <CreditCard size={18} />
                        Configuración y Aprobación de Pagos
                        {pendingPaymentsCount > 0 ? (
                            <span style={{
                                background: '#ef4444',
                                color: 'white',
                                padding: '0.15rem 0.55rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 800
                            }}>
                                {pendingPaymentsCount} pendiente{pendingPaymentsCount > 1 ? 's' : ''}
                            </span>
                        ) : (
                            <span style={{
                                background: activeTab === 'payments' ? 'rgba(255, 255, 255, 0.25)' : 'var(--surface)',
                                color: activeTab === 'payments' ? 'white' : 'var(--text-muted)',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 800
                            }}>
                                {payments.length}
                            </span>
                        )}
                    </button>
                </div>

                {activeTab === 'operators' && (
                    <>
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
                </>
                )}

                {/* ── Payments Management Tab ─────────────────────── */}
                {activeTab === 'payments' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Protocol Banner */}
                        <div className="glass" style={{
                            padding: '1.5rem',
                            borderRadius: 'var(--radius-lg)',
                            borderLeft: '4px solid var(--primary)',
                            background: 'rgba(37, 99, 235, 0.04)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                                <Shield size={20} color="var(--primary)" />
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                                    Esquema Tarifario y Flujo de Aprobación de Cuentas
                                </h3>
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                                gap: '1rem',
                                fontSize: '0.875rem',
                                color: 'var(--text-muted)',
                                lineHeight: 1.5
                            }}>
                                <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span style={{ color: '#10b981' }}>●</span> Contratistas Individuales ($60.000 COP)
                                    </div>
                                    La <strong>1ª cuenta de cobro (Acta 1) es de cortesía (gratuita)</strong>. A partir de la <strong>2ª cuenta (Acta 2 en adelante)</strong>, el bot solicita el pago del servicio antes de permitir el cargue de evidencias e informes.
                                </div>
                                <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span style={{ color: '#3b82f6' }}>●</span> Paquete 5 Cuentas ($100.000 COP)
                                    </div>
                                    Para contratistas o tramitadores de paquetes: <strong>5 cuentas por $100.000 COP</strong> ($20.000 c/u). En esta modalidad <strong>no aplican cuentas gratis</strong>; se realiza el pago previo para habilitar la carga de datos.
                                </div>
                                <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span style={{ color: '#f59e0b' }}>●</span> Notificación y Aprobación en Telegram
                                    </div>
                                    Al subir el comprobante en Telegram, el sistema extrae el remitente y reenvía el soporte a tu <strong>Telegram ID de Aprobación</strong> con botones interactivos <strong>[✅ Aprobar]</strong> y <strong>[❌ Rechazar]</strong>.
                                </div>
                            </div>
                        </div>

                        {/* KPI Stats */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1.25rem'
                        }}>
                            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #f59e0b' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pendientes de Aprobación</div>
                                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.25rem' }}>{pendingPaymentsCount}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Comprobantes por validar</div>
                            </div>
                            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #10b981' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pagos Aprobados</div>
                                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>{approvedPaymentsCount}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cuentas habilitadas con éxito</div>
                            </div>
                            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary)' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tarifa Contratista</div>
                                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>${Number(paymentConfig.contractorRate || 60000).toLocaleString('es-CO')}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Por cuenta (a partir de Acta 2)</div>
                            </div>
                            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #8b5cf6' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Paquete 5 Cuentas</div>
                                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#8b5cf6', marginTop: '0.25rem' }}>${Number(paymentConfig.packageRate || 100000).toLocaleString('es-CO')}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>$20.000 COP por cuenta (prepagado)</div>
                            </div>
                            <div className="glass" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', borderLeft: '4px solid #06b6d4' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Telegram ID Aprobador</div>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#06b6d4', marginTop: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {paymentConfig.approvalTelegramChatId || 'Sin configurar'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Receptor de comprobantes</div>
                            </div>
                        </div>

                        {/* Configuration Form Card */}
                        <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '1.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)' }}>
                                        <Sliders size={20} />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                                            Configuración de Canales de Pago y Aprobación
                                        </h2>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Ajusta el Telegram ID donde recibes las alertas para aprobar con un toque, y los datos bancarios que ven los contratistas.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSavePaymentConfig}
                                    disabled={savingConfig}
                                    className="btn btn-primary"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem' }}
                                >
                                    <Check size={16} />
                                    <span>{savingConfig ? 'Guardando...' : 'Guardar Cambios'}</span>
                                </button>
                            </div>

                            <form onSubmit={handleSavePaymentConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {/* Telegram Aprobador */}
                                <div style={{ background: 'var(--surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                                        🤖 Telegram Chat ID para Aprobación en Vivo <span style={{ color: 'var(--primary)' }}>*</span>
                                    </label>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <input
                                            type="text"
                                            value={paymentConfig.approvalTelegramChatId || ''}
                                            onChange={(e) => setPaymentConfig({ ...paymentConfig, approvalTelegramChatId: e.target.value })}
                                            placeholder="Ej. 123456789 (Obtenlo enviando /id al bot)"
                                            style={{
                                                flex: 1,
                                                minWidth: '260px',
                                                padding: '0.65rem 1rem',
                                                background: 'var(--background)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--text-main)',
                                                fontSize: '0.95rem',
                                                fontWeight: 600
                                            }}
                                        />
                                    </div>
                                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                        💡 <strong>¿Cómo obtener tu Chat ID?</strong> Abre Telegram, escribe al bot del sistema y envía el comando <code style={{ color: 'var(--primary)', fontWeight: 700 }}>/id</code>. El bot responderá con tu número. Cópialo y pégalo aquí. El bot te reenviará las fotos de consignaciones con botones para aprobarlas o rechazarlas en vivo desde tu celular.
                                    </p>
                                </div>

                                {/* Tarifas del Servicio */}
                                <div style={{ background: 'var(--surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <DollarSign size={18} color="var(--primary)" /> Tarifas Oficiales del Sistema (COP)
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                                Tarifa Cuenta Individual ($ COP)
                                            </label>
                                            <input
                                                type="number"
                                                value={paymentConfig.contractorRate || 60000}
                                                onChange={(e) => setPaymentConfig({ ...paymentConfig, contractorRate: Number(e.target.value) })}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.6rem 0.85rem',
                                                    background: 'var(--background)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: 'var(--text-main)',
                                                    fontWeight: 600
                                                }}
                                            />
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cuentas individuales (Acta 2 en adelante)</span>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                                Tarifa Paquete 5 Cuentas ($ COP)
                                            </label>
                                            <input
                                                type="number"
                                                value={paymentConfig.packageRate || 100000}
                                                onChange={(e) => setPaymentConfig({ ...paymentConfig, packageRate: Number(e.target.value) })}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.6rem 0.85rem',
                                                    background: 'var(--background)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: 'var(--text-main)',
                                                    fontWeight: 600
                                                }}
                                            />
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total por las 5 cuentas ($20.000 c/u)</span>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                                Cuentas en el Paquete
                                            </label>
                                            <input
                                                type="number"
                                                value={paymentConfig.packageAccountsCount || 5}
                                                onChange={(e) => setPaymentConfig({ ...paymentConfig, packageAccountsCount: Number(e.target.value) })}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.6rem 0.85rem',
                                                    background: 'var(--background)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: 'var(--text-main)',
                                                    fontWeight: 600
                                                }}
                                            />
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cantidad de cuentas asignadas por compra</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Canales e Instrucciones de Pago */}
                                <div style={{ background: 'var(--surface)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <CreditCard size={18} color="#10b981" /> Cuentas Bancarias e Instrucciones (Visibles para los contratistas)
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Entidad Bancaria</label>
                                            <input
                                                type="text"
                                                value={paymentConfig.paymentInstructions?.bankName || ''}
                                                onChange={(e) => setPaymentConfig({
                                                    ...paymentConfig,
                                                    paymentInstructions: { ...paymentConfig.paymentInstructions, bankName: e.target.value }
                                                })}
                                                placeholder="Ej. Bancolombia"
                                                style={{ width: '100%', padding: '0.6rem 0.85rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Número de Cuenta</label>
                                            <input
                                                type="text"
                                                value={paymentConfig.paymentInstructions?.accountNumber || ''}
                                                onChange={(e) => setPaymentConfig({
                                                    ...paymentConfig,
                                                    paymentInstructions: { ...paymentConfig.paymentInstructions, accountNumber: e.target.value }
                                                })}
                                                placeholder="Ej. 123-456789-00"
                                                style={{ width: '100%', padding: '0.6rem 0.85rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Tipo de Cuenta</label>
                                            <select
                                                value={paymentConfig.paymentInstructions?.accountType || 'Ahorros'}
                                                onChange={(e) => setPaymentConfig({
                                                    ...paymentConfig,
                                                    paymentInstructions: { ...paymentConfig.paymentInstructions, accountType: e.target.value }
                                                })}
                                                style={{ width: '100%', padding: '0.6rem 0.85rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
                                            >
                                                <option value="Ahorros">Cuenta de Ahorros</option>
                                                <option value="Corriente">Cuenta Corriente</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Número Nequi</label>
                                            <input
                                                type="text"
                                                value={paymentConfig.paymentInstructions?.nequiNumber || ''}
                                                onChange={(e) => setPaymentConfig({
                                                    ...paymentConfig,
                                                    paymentInstructions: { ...paymentConfig.paymentInstructions, nequiNumber: e.target.value }
                                                })}
                                                placeholder="Ej. 300 123 4567"
                                                style={{ width: '100%', padding: '0.6rem 0.85rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Número Daviplata</label>
                                            <input
                                                type="text"
                                                value={paymentConfig.paymentInstructions?.daviplataNumber || ''}
                                                onChange={(e) => setPaymentConfig({
                                                    ...paymentConfig,
                                                    paymentInstructions: { ...paymentConfig.paymentInstructions, daviplataNumber: e.target.value }
                                                })}
                                                placeholder="Ej. 300 123 4567"
                                                style={{ width: '100%', padding: '0.6rem 0.85rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Nombre del Titular</label>
                                            <input
                                                type="text"
                                                value={paymentConfig.paymentInstructions?.accountHolderName || ''}
                                                onChange={(e) => setPaymentConfig({
                                                    ...paymentConfig,
                                                    paymentInstructions: { ...paymentConfig.paymentInstructions, accountHolderName: e.target.value }
                                                })}
                                                placeholder="Nombre o Razón Social"
                                                style={{ width: '100%', padding: '0.6rem 0.85rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Cédula / NIT Titular</label>
                                            <input
                                                type="text"
                                                value={paymentConfig.paymentInstructions?.accountHolderId || ''}
                                                onChange={(e) => setPaymentConfig({
                                                    ...paymentConfig,
                                                    paymentInstructions: { ...paymentConfig.paymentInstructions, accountHolderId: e.target.value }
                                                })}
                                                placeholder="Ej. 1.094.123.456"
                                                style={{ width: '100%', padding: '0.6rem 0.85rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                            Instrucciones adicionales para el mensaje de Telegram
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={paymentConfig.paymentInstructions?.instructionsText || ''}
                                            onChange={(e) => setPaymentConfig({
                                                ...paymentConfig,
                                                paymentInstructions: { ...paymentConfig.paymentInstructions, instructionsText: e.target.value }
                                            })}
                                            placeholder="Ej. Por favor adjuntar foto clara del comprobante donde se aprecie la fecha, hora y número de aprobación."
                                            style={{ width: '100%', padding: '0.6rem 0.85rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)', resize: 'vertical' }}
                                        />
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Receipts List Card */}
                        <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '1.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>
                                        Bandeja de Comprobantes de Pago
                                    </h2>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Valida los pagos enviados por los contratistas para habilitar de inmediato el cargue de evidencias.
                                    </p>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {[
                                        { key: 'all', label: `Todos (${payments.length})` },
                                        { key: 'pending', label: `⏳ Pendientes (${pendingPaymentsCount})` },
                                        { key: 'approved', label: `✅ Aprobados (${approvedPaymentsCount})` },
                                        { key: 'rejected', label: `❌ Rechazados (${rejectedPaymentsCount})` }
                                    ].map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setPaymentFilterStatus(tab.key)}
                                            style={{
                                                padding: '0.45rem 0.85rem',
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid var(--border)',
                                                background: paymentFilterStatus === tab.key ? 'var(--primary)' : 'var(--surface)',
                                                color: paymentFilterStatus === tab.key ? 'white' : 'var(--text-main)',
                                                fontSize: '0.825rem',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Search bar */}
                            <div style={{ position: 'relative', marginBottom: '1.25rem', maxWidth: '450px' }}>
                                <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre, cédula o Telegram ID..."
                                    value={paymentSearch}
                                    onChange={(e) => setPaymentSearch(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 1rem 0.65rem 2.4rem',
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-main)',
                                        fontSize: '0.875rem'
                                    }}
                                />
                            </div>

                            {/* Table of receipts */}
                            {filteredPayments.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: 'var(--text-muted)' }}>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                                        <Receipt size={28} />
                                    </div>
                                    <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                                        No se encontraron comprobantes de pago
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '0.85rem' }}>
                                        {paymentSearch ? 'No hay resultados que coincidan con la búsqueda.' : 'Los comprobantes enviados por los contratistas desde Telegram aparecerán aquí en tiempo real.'}
                                    </p>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                                                <th style={{ padding: '0.75rem 1rem' }}>Soporte</th>
                                                <th style={{ padding: '0.75rem 1rem' }}>Contratista / Remitente</th>
                                                <th style={{ padding: '0.75rem 1rem' }}>Concepto</th>
                                                <th style={{ padding: '0.75rem 1rem' }}>Monto & Fecha</th>
                                                <th style={{ padding: '0.75rem 1rem' }}>Estado</th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredPayments.map(p => {
                                                const isPdf = (p.receiptFilePath || '').toLowerCase().endsWith('.pdf');
                                                const fileUrl = p.receiptFilePath ? `/${p.receiptFilePath.replace(/^\/+/, '')}` : '';
                                                const contractorName = p.contractorName || p.user?.fullName || 'Contratista';

                                                return (
                                                    <tr key={p._id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                                                        {/* Thumbnail */}
                                                        <td style={{ padding: '0.75rem 1rem' }}>
                                                            {p.receiptFilePath ? (
                                                                <div
                                                                    onClick={() => setSelectedReceiptForModal(p)}
                                                                    style={{
                                                                        width: '54px',
                                                                        height: '54px',
                                                                        borderRadius: 'var(--radius-sm)',
                                                                        overflow: 'hidden',
                                                                        border: '1px solid var(--border)',
                                                                        cursor: 'pointer',
                                                                        background: 'rgba(0, 0, 0, 0.2)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        position: 'relative'
                                                                    }}
                                                                    title="Clic para ver comprobante en grande"
                                                                >
                                                                    {isPdf ? (
                                                                        <FileText size={24} color="#ef4444" />
                                                                    ) : (
                                                                        <img
                                                                            src={fileUrl}
                                                                            alt="Comprobante"
                                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                        />
                                                                    )}
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        inset: 0,
                                                                        background: 'rgba(0,0,0,0.3)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        opacity: 0,
                                                                        transition: 'opacity 0.2s'
                                                                    }}
                                                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                                                                    >
                                                                        <Eye size={16} color="white" />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Sin archivo</span>
                                                            )}
                                                        </td>

                                                        {/* Contratista */}
                                                        <td style={{ padding: '0.75rem 1rem' }}>
                                                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{contractorName}</div>
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                                C.C. {p.cedula || 'N/A'}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem', fontSize: '0.75rem' }}>
                                                                <code style={{ background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                                                    ID: {p.telegramChatId || 'N/A'}
                                                                </code>
                                                                {p.telegramChatId && (
                                                                    <button
                                                                        onClick={() => copyToClipboard(p.telegramChatId, `chat_${p._id}`)}
                                                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
                                                                        title="Copiar Telegram ID"
                                                                    >
                                                                        {copiedId === `chat_${p._id}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                                                                    </button>
                                                                )}
                                                                {p.telegramUsername && (
                                                                    <span style={{ color: 'var(--text-muted)' }}>@{p.telegramUsername}</span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Concepto */}
                                                        <td style={{ padding: '0.75rem 1rem' }}>
                                                            {p.paymentType === 'package' ? (
                                                                <span style={{
                                                                    padding: '0.25rem 0.6rem',
                                                                    borderRadius: '12px',
                                                                    background: 'rgba(139, 92, 246, 0.15)',
                                                                    color: '#8b5cf6',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.78rem',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.3rem'
                                                                }}>
                                                                    📦 Paquete (5 Cuentas)
                                                                </span>
                                                            ) : (
                                                                <span style={{
                                                                    padding: '0.25rem 0.6rem',
                                                                    borderRadius: '12px',
                                                                    background: 'rgba(59, 130, 246, 0.15)',
                                                                    color: 'var(--primary)',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.78rem',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.3rem'
                                                                }}>
                                                                    📑 Acta N° {p.actNumber || 2}
                                                                </span>
                                                            )}
                                                            {p.contract?.contractNumber && (
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                                    Contrato: {p.contract.contractNumber}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* Monto & Fecha */}
                                                        <td style={{ padding: '0.75rem 1rem' }}>
                                                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                                                ${Number(p.amount || 60000).toLocaleString('es-CO')} COP
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                {new Date(p.createdAt).toLocaleDateString('es-CO')} {new Date(p.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </td>

                                                        {/* Estado */}
                                                        <td style={{ padding: '0.75rem 1rem' }}>
                                                            {p.status === 'pending' ? (
                                                                <div>
                                                                    <span style={{
                                                                        padding: '0.25rem 0.65rem',
                                                                        borderRadius: '12px',
                                                                        background: 'rgba(245, 158, 11, 0.15)',
                                                                        color: '#f59e0b',
                                                                        fontWeight: 700,
                                                                        fontSize: '0.78rem',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.3rem'
                                                                    }}>
                                                                        ⏳ Pendiente
                                                                    </span>
                                                                </div>
                                                            ) : p.status === 'approved' ? (
                                                                <div>
                                                                    <span style={{
                                                                        padding: '0.25rem 0.65rem',
                                                                        borderRadius: '12px',
                                                                        background: 'rgba(16, 185, 129, 0.15)',
                                                                        color: '#10b981',
                                                                        fontWeight: 700,
                                                                        fontSize: '0.78rem',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.3rem'
                                                                    }}>
                                                                        ✅ Aprobado
                                                                    </span>
                                                                    {p.approvedBy && (
                                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                                            Por: {p.approvedBy}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    <span style={{
                                                                        padding: '0.25rem 0.65rem',
                                                                        borderRadius: '12px',
                                                                        background: 'rgba(239, 68, 68, 0.15)',
                                                                        color: '#ef4444',
                                                                        fontWeight: 700,
                                                                        fontSize: '0.78rem',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.3rem'
                                                                    }}>
                                                                        ❌ Rechazado
                                                                    </span>
                                                                    {p.rejectionReason && (
                                                                        <div style={{ fontSize: '0.72rem', color: 'var(--error)', marginTop: '0.2rem', maxWidth: '200px' }}>
                                                                            {p.rejectionReason}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* Acciones */}
                                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                                            <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedReceiptForModal(p)}
                                                                    className="btn"
                                                                    style={{
                                                                        padding: '0.4rem 0.75rem',
                                                                        fontSize: '0.8rem',
                                                                        background: 'var(--surface)',
                                                                        border: '1px solid var(--border)',
                                                                        color: 'var(--text-main)',
                                                                        borderRadius: 'var(--radius-sm)',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.35rem'
                                                                    }}
                                                                >
                                                                    <Eye size={14} />
                                                                    <span>Ver</span>
                                                                </button>

                                                                {p.status === 'pending' && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleApprovePayment(p._id)}
                                                                            disabled={actionLoadingId === p._id}
                                                                            className="btn"
                                                                            style={{
                                                                                padding: '0.4rem 0.75rem',
                                                                                fontSize: '0.8rem',
                                                                                background: '#10b981',
                                                                                border: 'none',
                                                                                color: 'white',
                                                                                fontWeight: 600,
                                                                                borderRadius: 'var(--radius-sm)',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '0.35rem',
                                                                                cursor: 'pointer'
                                                                            }}
                                                                        >
                                                                            {actionLoadingId === p._id ? (
                                                                                <RefreshCw size={14} className="animate-spin" />
                                                                            ) : (
                                                                                <Check size={14} />
                                                                            )}
                                                                            <span>Aprobar</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setRejectModalPayment(p);
                                                                                setRejectionReason('');
                                                                            }}
                                                                            disabled={actionLoadingId === p._id}
                                                                            className="btn"
                                                                            style={{
                                                                                padding: '0.4rem 0.75rem',
                                                                                fontSize: '0.8rem',
                                                                                background: 'rgba(239, 68, 68, 0.1)',
                                                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                                                color: '#ef4444',
                                                                                fontWeight: 600,
                                                                                borderRadius: 'var(--radius-sm)',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '0.35rem',
                                                                                cursor: 'pointer'
                                                                            }}
                                                                        >
                                                                            <X size={14} />
                                                                            <span>Rechazar</span>
                                                                        </button>
                                                                    </>
                                                                )}
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
                    </div>
                )}


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

                {/* ── Modal View Payment Receipt ──────────────────────── */}
                <AnimatePresence>
                    {selectedReceiptForModal && (
                        <div style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.85)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 110,
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
                                    maxWidth: '720px',
                                    maxHeight: '90vh',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                                }}
                            >
                                {/* Header */}
                                <div style={{
                                    padding: '1rem 1.25rem',
                                    borderBottom: '1px solid var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'rgba(255, 255, 255, 0.02)'
                                }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                                            Comprobante: {selectedReceiptForModal.contractorName || selectedReceiptForModal.user?.fullName || 'Contratista'}
                                        </h3>
                                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                            <span>C.C. {selectedReceiptForModal.cedula || 'N/A'}</span>
                                            <span>•</span>
                                            <span>Monto: <strong>${Number(selectedReceiptForModal.amount || 60000).toLocaleString('es-CO')} COP</strong></span>
                                            <span>•</span>
                                            <span>{selectedReceiptForModal.paymentType === 'package' ? 'Paquete 5 Cuentas' : `Acta N° ${selectedReceiptForModal.actNumber || 2}`}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedReceiptForModal(null)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                                    >
                                        <X size={22} />
                                    </button>
                                </div>

                                {/* Body Content (Image or PDF) */}
                                <div style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    padding: '1.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#0d1117'
                                }}>
                                    {(selectedReceiptForModal.receiptFilePath || '').toLowerCase().endsWith('.pdf') ? (
                                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                                            <FileText size={64} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
                                            <p style={{ color: 'white', marginBottom: '1rem', fontWeight: 600 }}>Archivo en formato PDF</p>
                                            <a
                                                href={`/${selectedReceiptForModal.receiptFilePath.replace(/^\/+/, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-primary"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
                                            >
                                                <ExternalLink size={16} /> Abrir PDF en Nueva Pestaña
                                            </a>
                                        </div>
                                    ) : (
                                        <img
                                            src={`/${(selectedReceiptForModal.receiptFilePath || '').replace(/^\/+/, '')}`}
                                            alt="Comprobante de Pago Completo"
                                            style={{
                                                maxWidth: '100%',
                                                maxHeight: '65vh',
                                                objectFit: 'contain',
                                                borderRadius: 'var(--radius-sm)'
                                            }}
                                        />
                                    )}
                                </div>

                                {/* Footer with actions */}
                                <div style={{
                                    padding: '1rem 1.25rem',
                                    borderTop: '1px solid var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '0.75rem',
                                    background: 'var(--surface)'
                                }}>
                                    <a
                                        href={`/${(selectedReceiptForModal.receiptFilePath || '').replace(/^\/+/, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            fontSize: '0.825rem',
                                            background: 'transparent',
                                            border: '1px solid var(--border)',
                                            color: 'var(--text-main)',
                                            textDecoration: 'none'
                                        }}
                                    >
                                        <Download size={14} /> Descargar Archivo
                                    </a>

                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {selectedReceiptForModal.status === 'pending' ? (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        const p = selectedReceiptForModal;
                                                        setSelectedReceiptForModal(null);
                                                        setRejectModalPayment(p);
                                                        setRejectionReason('');
                                                    }}
                                                    className="btn"
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        color: '#ef4444',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 600,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.35rem'
                                                    }}
                                                >
                                                    <X size={15} /> Rechazar
                                                </button>
                                                <button
                                                    onClick={() => handleApprovePayment(selectedReceiptForModal._id)}
                                                    disabled={actionLoadingId === selectedReceiptForModal._id}
                                                    className="btn"
                                                    style={{
                                                        background: '#10b981',
                                                        border: 'none',
                                                        color: 'white',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 600,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.35rem'
                                                    }}
                                                >
                                                    {actionLoadingId === selectedReceiptForModal._id ? (
                                                        <RefreshCw size={15} className="animate-spin" />
                                                    ) : (
                                                        <Check size={15} />
                                                    )}
                                                    Aprobar Pago
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => setSelectedReceiptForModal(null)}
                                                className="btn"
                                                style={{ background: 'var(--primary)', color: 'white', fontSize: '0.85rem', fontWeight: 600 }}
                                            >
                                                Cerrar Visor
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* ── Modal Reject Payment ─────────────────────────────── */}
                <AnimatePresence>
                    {rejectModalPayment && (
                        <div style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.8)',
                            backdropFilter: 'blur(5px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 120,
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
                                    maxWidth: '520px',
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
                                    <XCircle size={26} />
                                </div>

                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                                    Rechazar Comprobante de Pago
                                </h3>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
                                    Se notificará por Telegram a <strong>"{rejectModalPayment.contractorName || 'el contratista'}"</strong> informándole la novedad para que remita un nuevo soporte.
                                </p>

                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                    Motivo del Rechazo:
                                </label>

                                {/* Quick option pills */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                    {[
                                        'Comprobante ilegible o borroso',
                                        'Valor incompleto o diferente a la tarifa',
                                        'Transferencia no recibida en la cuenta',
                                        'Comprobante duplicado o ya utilizado'
                                    ].map(reason => (
                                        <button
                                            key={reason}
                                            type="button"
                                            onClick={() => setRejectionReason(reason)}
                                            style={{
                                                fontSize: '0.75rem',
                                                padding: '0.25rem 0.55rem',
                                                borderRadius: '12px',
                                                background: rejectionReason === reason ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                border: `1px solid ${rejectionReason === reason ? 'rgba(239, 68, 68, 0.4)' : 'var(--border)'}`,
                                                color: rejectionReason === reason ? '#ef4444' : 'var(--text-main)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {reason}
                                        </button>
                                    ))}
                                </div>

                                <textarea
                                    rows={3}
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Detalla la razón por la que no se aprueba el pago..."
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 0.85rem',
                                        background: 'var(--background)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-main)',
                                        fontSize: '0.875rem',
                                        marginBottom: '1.25rem',
                                        resize: 'vertical'
                                    }}
                                />

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRejectModalPayment(null);
                                            setRejectionReason('');
                                        }}
                                        disabled={actionLoadingId === rejectModalPayment._id}
                                        className="btn"
                                        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmRejectPayment}
                                        disabled={actionLoadingId === rejectModalPayment._id}
                                        className="btn"
                                        style={{ background: 'var(--error)', color: 'white', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                    >
                                        {actionLoadingId === rejectModalPayment._id ? (
                                            <RefreshCw size={14} className="animate-spin" />
                                        ) : (
                                            <X size={16} />
                                        )}
                                        Confirmar Rechazo
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

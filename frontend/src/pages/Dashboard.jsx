import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    LogOut,
    Users,
    Settings,
    FileText,
    Shield,
    Layers,
    RefreshCw,
    Clock,
    CheckCircle2,
    ArrowRight,
    FileCheck,
    Package,
    MessageCircle,
    Building2,
    Calendar,
    Eye
} from 'lucide-react';

export default function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [stats, setStats] = useState({
        contractorsCount: 0,
        telegramLinkedCount: 0,
        pendingAccountsCount: 0,
        totalAccountsCount: 0,
        documentsCount: 0,
        zipCount: 0,
        templatesCount: 0,
        telegramOperatorsCount: 0,
        recentPendingAccounts: []
    });

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setRefreshing(true);
        try {
            const [usersRes, accountsRes, docsRes, templatesRes, privRes] = await Promise.allSettled([
                api.get('/admin/users'),
                api.get('/admin/accounts'),
                api.get('/admin/documents'),
                api.get('/admin/templates'),
                api.get('/admin/telegram-privileges')
            ]);

            const users = usersRes.status === 'fulfilled' ? (usersRes.value.data || []) : [];
            const accounts = accountsRes.status === 'fulfilled' ? (accountsRes.value.data || []) : [];
            const docs = docsRes.status === 'fulfilled' ? (docsRes.value.data || []) : [];
            const templates = templatesRes.status === 'fulfilled' ? (templatesRes.value.data || []) : [];
            const privileges = privRes.status === 'fulfilled' ? (privRes.value.data || []) : [];

            const nonAdminUsers = users.filter(u => u.role !== 'admin');
            const telegramLinked = nonAdminUsers.filter(u => u.telegramLinked).length;
            const pendingAccounts = accounts.filter(a => a.status === 'pending');
            const zipFiles = docs.filter(d => d.type === 'zip_package' || d.category === 'Paquete ZIP');
            const activeOperators = privileges.filter(p => p.isActive).length;

            setStats({
                contractorsCount: nonAdminUsers.length,
                telegramLinkedCount: telegramLinked,
                pendingAccountsCount: pendingAccounts.length,
                totalAccountsCount: accounts.length,
                documentsCount: docs.length,
                zipCount: zipFiles.length,
                templatesCount: templates.length,
                telegramOperatorsCount: activeOperators,
                recentPendingAccounts: pendingAccounts.slice(0, 5)
            });
        } catch (err) {
            console.error('Error fetching admin dashboard data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const formatCurrency = (val) => {
        if (!val) return '$ 0';
        const num = parseFloat(String(val).replace(/\D/g, ''));
        if (isNaN(num)) return val;
        return '$ ' + num.toLocaleString('es-CO');
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--text-main)', transition: 'background 0.3s, color 0.3s' }}>
            {/* ── Top Navbar ─────────────────────────────────────────── */}
            <nav className="glass" style={{
                padding: '0.875rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                zIndex: 50,
                borderBottom: '1px solid var(--border)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, var(--primary), #1d4ed8)',
                        color: 'white',
                        padding: '0.55rem',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(37,99,235,0.3)'
                    }}>
                        <Shield size={20} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>Formatos Cuentas</h2>
                            <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: 'rgba(37,99,235,0.12)',
                                color: 'var(--primary)',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '999px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                Administrador Maestro
                            </span>
                        </div>
                    </div>
                </div>

                {/* Direct Module Links */}
                <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                        onClick={() => navigate('/admin/contractors')}
                        className="btn"
                        style={{
                            background: 'transparent',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            padding: '0.45rem 0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <Users size={16} color="var(--primary)" />
                        <span>Contratistas</span>
                    </button>
                    <button
                        onClick={() => navigate('/admin/accounts')}
                        className="btn"
                        style={{
                            background: 'transparent',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            padding: '0.45rem 0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            position: 'relative'
                        }}
                    >
                        <FileCheck size={16} color="var(--primary)" />
                        <span>Cuentas</span>
                        {stats.pendingAccountsCount > 0 && (
                            <span style={{
                                background: 'var(--accent)',
                                color: 'white',
                                fontSize: '0.7rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '999px',
                                fontWeight: 700
                            }}>
                                {stats.pendingAccountsCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => navigate('/admin/documents')}
                        className="btn"
                        style={{
                            background: 'transparent',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            padding: '0.45rem 0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <Layers size={16} color="var(--primary)" />
                        <span>Documentos & ZIPs</span>
                    </button>
                    <button
                        onClick={() => navigate('/admin/formats')}
                        className="btn"
                        style={{
                            background: 'transparent',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            padding: '0.45rem 0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <Settings size={16} color="var(--primary)" />
                        <span>Plantillas</span>
                    </button>
                    <button
                        onClick={() => navigate('/admin/secretarias')}
                        className="btn"
                        style={{
                            background: 'transparent',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            padding: '0.45rem 0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <Building2 size={16} color="#0284c7" />
                        <span>Diccionario Secretarías</span>
                    </button>
                    <button
                        onClick={() => navigate('/admin/telegram')}
                        className="btn"
                        style={{
                            background: 'transparent',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            padding: '0.45rem 0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <Shield size={16} color="#8b5cf6" />
                        <span>Telegram Multicuenta</span>
                    </button>
                </div>

                {/* User Info & Logout */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: '600', margin: 0 }}>{user?.fullName || 'Super Admin'}</p>
                            <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', margin: 0 }}>{user?.email || 'admin@sistema.gov.co'}</p>
                        </div>
                        <div style={{
                            width: '38px',
                            height: '38px',
                            background: 'rgba(37,99,235,0.1)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(37,99,235,0.2)'
                        }}>
                            <Shield size={18} color="var(--primary)" />
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="btn"
                        style={{
                            background: 'transparent',
                            color: 'var(--error)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            padding: '0.45rem 0.9rem',
                            fontSize: '0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <LogOut size={15} />
                        <span className="hide-mobile">Cerrar Sesión</span>
                    </button>
                </div>
            </nav>

            {/* ── Main Content Container ─────────────────────────────── */}
            <main className="container" style={{ paddingTop: '2.5rem', paddingBottom: '5rem' }}>

                {/* ── Executive Header ─────────────────────────────────── */}
                <div style={{
                    marginBottom: '2.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '1.25rem'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.8rem',
                                color: 'var(--primary)',
                                fontWeight: 600,
                                background: 'rgba(37, 99, 235, 0.08)',
                                padding: '0.2rem 0.6rem',
                                borderRadius: 'var(--radius-sm)'
                            }}>
                                <Shield size={14} /> Panel de Control Central
                            </span>
                        </div>
                        <h1 style={{ fontSize: '2.1rem', margin: '0 0 0.4rem 0', fontWeight: 800, letterSpacing: '-0.03em' }}>
                            Panel del Administrador Maestro
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0, maxWidth: '650px' }}>
                            Supervisión unificada de contratistas, auditoría de cuentas de cobro, verificación PILA y repositorio documental multi-contrato.
                        </p>
                    </div>

                    <button
                        onClick={loadDashboardData}
                        disabled={refreshing}
                        className="btn"
                        style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-main)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.55rem 1rem',
                            boxShadow: 'var(--shadow)',
                            borderRadius: 'var(--radius-md)'
                        }}
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} color="var(--primary)" />
                        <span>{refreshing ? 'Sincronizando...' : 'Actualizar Datos'}</span>
                    </button>
                </div>

                {/* ── KPI Metrics Grid ─────────────────────────────────── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '1.25rem',
                    marginBottom: '2.5rem'
                }}>
                    {/* KPI 1: Contratistas */}
                    <div
                        className="glass"
                        onClick={() => navigate('/admin/contractors')}
                        style={{
                            padding: '1.5rem',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            borderLeft: '4px solid #3b82f6',
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Contratistas Registrados</span>
                            <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
                                <Users size={22} />
                            </div>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                            {loading ? '...' : stats.contractorsCount}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <MessageCircle size={14} color="#10b981" />
                            <span>{stats.telegramLinkedCount} activos en Telegram</span>
                        </div>
                    </div>

                    {/* KPI 2: Cuentas Pendientes */}
                    <div
                        className="glass"
                        onClick={() => navigate('/admin/accounts')}
                        style={{
                            padding: '1.5rem',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            borderLeft: stats.pendingAccountsCount > 0 ? '4px solid var(--accent)' : '4px solid var(--success)',
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Cuentas por Revisar</span>
                            <div style={{
                                background: stats.pendingAccountsCount > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                color: stats.pendingAccountsCount > 0 ? 'var(--accent)' : 'var(--success)',
                                padding: '0.5rem',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <Clock size={22} />
                            </div>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                            {loading ? '...' : stats.pendingAccountsCount}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {stats.totalAccountsCount} cuentas registradas en total
                        </div>
                    </div>

                    {/* KPI 3: Documentos & ZIPs */}
                    <div
                        className="glass"
                        onClick={() => navigate('/admin/documents')}
                        style={{
                            padding: '1.5rem',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            borderLeft: '4px solid #8b5cf6',
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Repositorio de Archivos</span>
                            <div style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
                                <Layers size={22} />
                            </div>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                            {loading ? '...' : stats.documentsCount}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Package size={14} color="#8b5cf6" />
                            <span>{stats.zipCount} paquetes ZIP finales generados</span>
                        </div>
                    </div>

                    {/* KPI 4: Plantillas Institucionales */}
                    <div
                        className="glass"
                        onClick={() => navigate('/admin/formats')}
                        style={{
                            padding: '1.5rem',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            borderLeft: '4px solid #10b981',
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Plantillas Oficiales</span>
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
                                <Settings size={22} />
                            </div>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                            {loading ? '...' : `${stats.templatesCount} / 4`}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Formatos Word y PDF activos en servidor
                        </div>
                    </div>
                </div>

                {/* ── Main Administrative Modules ────────────────────── */}
                <div style={{ marginBottom: '3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                        <Shield size={20} color="var(--primary)" />
                        <h2 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>Módulos de Gestión</h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {/* Module 1: Contratistas */}
                        <div className="glass" style={{
                            padding: '2rem',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                        }}>
                            <div>
                                <div style={{
                                    width: '52px',
                                    height: '52px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    color: 'var(--primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '1.25rem'
                                }}>
                                    <Users size={28} />
                                </div>
                                <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>Directorio de Contratistas</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                                    Búsqueda por cédula o nombre. Consulta expedientes, contratos asociados (múltiples contratos, alcaldías y entidades), fechas de corte y estado de Telegram.
                                </p>
                            </div>
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', gap: '0.5rem' }}
                                onClick={() => navigate('/admin/contractors')}
                            >
                                <span>Ver Directorio</span>
                                <ArrowRight size={16} />
                            </button>
                        </div>

                        {/* Module 2: Cuentas Pendientes */}
                        <div className="glass" style={{
                            padding: '2rem',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                        }}>
                            <div>
                                <div style={{
                                    width: '52px',
                                    height: '52px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'rgba(245, 158, 11, 0.1)',
                                    color: 'var(--accent)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '1.25rem'
                                }}>
                                    <FileCheck size={28} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>Revisión de Cuentas</h3>
                                    {stats.pendingAccountsCount > 0 && (
                                        <span style={{
                                            background: 'var(--accent)',
                                            color: 'white',
                                            fontSize: '0.725rem',
                                            fontWeight: 700,
                                            padding: '0.15rem 0.5rem',
                                            borderRadius: '999px'
                                        }}>
                                            {stats.pendingAccountsCount} pendientes
                                        </span>
                                    )}
                                </div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                                    Audita las cuentas de cobro generadas por los contratistas, valida soportes de pago PILA (seguridad social), aprueba para desembolso o emite observaciones.
                                </p>
                            </div>
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', gap: '0.5rem', background: stats.pendingAccountsCount > 0 ? 'var(--accent)' : 'var(--primary)' }}
                                onClick={() => navigate('/admin/accounts')}
                            >
                                <span>Revisar Cuentas</span>
                                <ArrowRight size={16} />
                            </button>
                        </div>

                        {/* Module 3: Documentos y ZIPs */}
                        <div className="glass" style={{
                            padding: '2rem',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                        }}>
                            <div>
                                <div style={{
                                    width: '52px',
                                    height: '52px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'rgba(139, 92, 246, 0.1)',
                                    color: '#8b5cf6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '1.25rem'
                                }}>
                                    <Layers size={28} />
                                </div>
                                <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>Repositorio de Archivos & ZIPs</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                                    Explora minutas, actas de inicio, RP presupuestales, evidencias de actividades y paquetes ZIP descargables. Permite depurar archivos erróneos.
                                </p>
                            </div>
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', gap: '0.5rem' }}
                                onClick={() => navigate('/admin/documents')}
                            >
                                <span>Explorar Documentos</span>
                                <ArrowRight size={16} />
                            </button>
                        </div>

                        {/* Module 4: Plantillas Institucionales */}
                        <div className="glass" style={{
                            padding: '2rem',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                        }}>
                            <div>
                                <div style={{
                                    width: '52px',
                                    height: '52px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    color: '#10b981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '1.25rem'
                                }}>
                                    <Settings size={28} />
                                </div>
                                <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>Plantillas y Formatos</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                                    Carga y actualiza los 4 formatos oficiales de Word: Informe de Actividades, Certificado de Supervisor, Retención en la Fuente y Descuento de Estampillas.
                                </p>
                            </div>
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', gap: '0.5rem' }}
                                onClick={() => navigate('/admin/formats')}
                            >
                                <span>Configurar Plantillas</span>
                                <ArrowRight size={16} />
                            </button>
                        </div>

                        {/* Module 5: Privilegios Telegram Multicuenta */}
                        <div className="glass" style={{
                            padding: '2rem',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            borderLeft: '4px solid #8b5cf6'
                        }}>
                            <div>
                                <div style={{
                                    width: '52px',
                                    height: '52px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'rgba(139, 92, 246, 0.1)',
                                    color: '#8b5cf6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '1.25rem'
                                }}>
                                    <Shield size={28} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>Privilegios Telegram (Multicuenta)</h3>
                                    {stats.telegramOperatorsCount > 0 && (
                                        <span style={{
                                            background: 'rgba(139, 92, 246, 0.15)',
                                            color: '#8b5cf6',
                                            fontSize: '0.725rem',
                                            fontWeight: 700,
                                            padding: '0.15rem 0.5rem',
                                            borderRadius: '999px'
                                        }}>
                                            {stats.telegramOperatorsCount} activos
                                        </span>
                                    )}
                                </div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                                    Autoriza IDs de Telegram para permitir que un mismo chat tramite cuentas de cobro de diferentes funcionarios, con cambio de usuario en tiempo real y descarga de paquetes ZIP.
                                </p>
                            </div>
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', gap: '0.5rem', background: '#8b5cf6' }}
                                onClick={() => navigate('/admin/telegram')}
                            >
                                <span>Gestionar Privilegios</span>
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Pending Accounts Urgent Attention Section ────────── */}
                <div style={{ marginBottom: '3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileCheck size={20} color="var(--primary)" />
                            <h2 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>Cuentas Pendientes de Aprobación</h2>
                        </div>
                        {stats.pendingAccountsCount > 0 && (
                            <button
                                onClick={() => navigate('/admin/accounts')}
                                className="btn"
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-main)',
                                    fontSize: '0.825rem',
                                    padding: '0.4rem 0.8rem',
                                    gap: '0.35rem'
                                }}
                            >
                                <span>Ver todas ({stats.pendingAccountsCount})</span>
                                <ArrowRight size={14} />
                            </button>
                        )}
                    </div>

                    {stats.recentPendingAccounts.length > 0 ? (
                        <div className="glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '0.9rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)' }}>Contratista</th>
                                            <th style={{ padding: '0.9rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)' }}>Contrato / Entidad</th>
                                            <th style={{ padding: '0.9rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)' }}>Acta / Periodo</th>
                                            <th style={{ padding: '0.9rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)' }}>Valor</th>
                                            <th style={{ padding: '0.9rem 1.25rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.recentPendingAccounts.map((acc) => (
                                            <tr key={acc._id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <p style={{ fontWeight: 600, margin: 0 }}>{acc.user?.fullName || 'Contratista'}</p>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{acc.user?.email || 'Sin correo'}</span>
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                        <Building2 size={14} color="var(--primary)" />
                                                        <span style={{ fontWeight: 500 }}>{acc.contract?.entityName || 'Alcaldía de Armenia'}</span>
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        Contrato: {acc.contract?.contractNumber || 'General'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <span style={{
                                                        background: 'rgba(59, 130, 246, 0.1)',
                                                        color: 'var(--primary)',
                                                        padding: '0.2rem 0.5rem',
                                                        borderRadius: 'var(--radius-sm)',
                                                        fontWeight: 600,
                                                        fontSize: '0.75rem'
                                                    }}>
                                                        Acta N° {acc.actNumber || '1'}
                                                    </span>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                        {acc.month || (acc.createdAt ? new Date(acc.createdAt).toLocaleDateString('es-CO') : 'Reciente')}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                    {formatCurrency(acc.amount)}
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                                                    <button
                                                        onClick={() => navigate('/admin/accounts')}
                                                        className="btn"
                                                        style={{
                                                            background: 'rgba(245, 158, 11, 0.1)',
                                                            color: 'var(--accent)',
                                                            border: '1px solid rgba(245, 158, 11, 0.3)',
                                                            padding: '0.4rem 0.8rem',
                                                            fontSize: '0.8rem',
                                                            gap: '0.35rem'
                                                        }}
                                                    >
                                                        <Eye size={14} />
                                                        <span>Auditar</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="glass" style={{
                            padding: '2.5rem',
                            borderRadius: 'var(--radius-lg)',
                            textAlign: 'center',
                            boxShadow: 'var(--shadow)'
                        }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '50%',
                                background: 'rgba(34, 197, 94, 0.1)',
                                color: 'var(--success)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1rem'
                            }}>
                                <CheckCircle2 size={32} />
                            </div>
                            <h3 style={{ margin: '0 0 0.4rem 0', fontWeight: 700 }}>¡Todo al día!</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                                No hay cuentas de cobro pendientes de revisión en este momento. Las nuevas radicaciones aparecerán aquí automáticamente.
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Operational Notice: Telegram Contractor Channel ─── */}
                <div className="glass" style={{
                    padding: '1.75rem 2rem',
                    borderRadius: 'var(--radius-lg)',
                    borderLeft: '4px solid #10b981',
                    background: 'rgba(16, 185, 129, 0.04)',
                    boxShadow: 'var(--shadow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1.5rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', maxWidth: '800px' }}>
                        <div style={{
                            background: '#10b981',
                            color: 'white',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.75rem',
                            display: 'flex',
                            flexShrink: 0
                        }}>
                            <MessageCircle size={26} />
                        </div>
                        <div>
                            <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                Canal Operativo Exclusivo para Contratistas
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                Los contratistas gestionan sus contratos, suben sus evidencias fotográficas mes a mes y generan sus paquetes ZIP de cobro de forma 100% autónoma a través del <strong>Bot de Telegram</strong> con IA. Este portal web es de uso exclusivo para supervisión y administración.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: 'rgba(37, 99, 235, 0.1)',
                            color: 'var(--primary)',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '999px'
                        }}>
                            Multi-Contrato Habilitado
                        </span>
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#10b981',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '999px'
                        }}>
                            Auditoría en Tiempo Real
                        </span>
                    </div>
                </div>

            </main>
        </div>
    );
}

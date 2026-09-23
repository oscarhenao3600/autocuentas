import React from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    LogOut, User, Users, Settings, FileText, Upload, AlertCircle,
    ChevronRight, Calendar, MessageCircle, Package, Download, Clock, Shield, Layers
} from 'lucide-react';
import BillingForm from '../components/BillingForm';
import { calculatePeriods } from '../utils/period.utils';

// ── Helper: days until cutoff ─────────────────────────────────
function daysUntilCutoff(cutoffDay) {
    const today = new Date();
    let target  = new Date(today.getFullYear(), today.getMonth(), cutoffDay);
    if (today > target) {
        // already passed this month → next month
        target = new Date(today.getFullYear(), today.getMonth() + 1, cutoffDay);
    }
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    return { days: diff, date: target.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) };
}

// ── Small stat card ────────────────────────────────────────────
function StatCard({ icon, label, value, accent, onClick }) {
    return (
        <div
            className="glass"
            onClick={onClick}
            style={{
                padding: '1.25rem 1.5rem',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'transform 0.2s, box-shadow 0.2s',
                borderLeft: accent ? `4px solid ${accent}` : 'none'
            }}
        >
            <div style={{ color: accent || 'var(--primary)', flexShrink: 0 }}>{icon}</div>
            <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{label}</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{value}</p>
            </div>
        </div>
    );
}

const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [showForm, setShowForm]       = React.useState(false);
    const [contract, setContract]       = React.useState(null);
    const [reminderStatus, setReminderStatus] = React.useState(null);
    const [telegramCode, setTelegramCode] = React.useState('');
    const [showTelegram, setShowTelegram] = React.useState(false);

    React.useEffect(() => {
        api.get('/contracts')
            .then(({ data }) => setContract(data))
            .catch(() => {});

        api.get('/contracts/reminder-status')
            .then(({ data }) => setReminderStatus(data))
            .catch(() => {});
    }, []);

    const handleFormComplete = (result) => {
        setShowForm(false);
        // Auto-download the zip
        if (result?.zipUrl) {
            const base = (import.meta.env.VITE_API_URL || '').replace('/api', '');
            window.open(`${base}${result.zipUrl}`, '_blank');
        }
        navigate('/my-documents');
    };

    const generateTelegramCode = async () => {
        try {
            const { data } = await api.get('/billing/telegram/code');
            setTelegramCode(data.code);
            setShowTelegram(true);
        } catch (err) {
            alert('Error al generar el código: ' + (err.response?.data?.message || err.message));
        }
    };

    const cutoffInfo = contract?.cutoffDay ? daysUntilCutoff(contract.cutoffDay) : null;

    const activeCutoffInfo = React.useMemo(() => {
        if (!contract || !contract.startDate) return null;
        const periods = calculatePeriods(
            contract.startDate,
            contract.initialDurationMonths || 4,
            contract.additionDurationMonths || 0,
            contract.periodType || 'mes_cumplido',
            contract.endDate
        );
        if (!periods || periods.length === 0) return null;

        const now = new Date();
        for (const p of periods) {
            const periodEnd = new Date(p.to + 'T23:59:59');
            const diffTime = periodEnd.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 0) {
                return {
                    actNumber: p.actNumber,
                    days: diffDays,
                    date: p.to,
                    isAddition: p.isAddition
                };
            }
        }
        return null;
    }, [contract]);

    // ──────────────────────────────────────────────────────────
    return (
        <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--text-main)', transition: 'background 0.3s, color 0.3s' }}>
            {/* ── Navbar ─────────────────────────────────────────────── */}
            <nav className="glass" style={{
                padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', position: 'sticky', top: 0, zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem', borderRadius: 'var(--radius-md)' }}>
                        <FileText size={20} />
                    </div>
                    <h2 style={{ fontSize: '1.25rem' }}>Formatos Cuentas</h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button 
                        onClick={() => navigate('/contract-setup')} 
                        className="btn" 
                        style={{ 
                            background: 'rgba(59, 130, 246, 0.1)', 
                            color: 'var(--primary)', 
                            border: '1px solid rgba(59, 130, 246, 0.25)', 
                            padding: '0.45rem 0.9rem',
                            fontSize: '0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            cursor: 'pointer',
                            borderRadius: 'var(--radius-md)'
                        }}
                    >
                        <FileText size={15} />
                        <span>Mi Contrato</span>
                    </button>

                    <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: '600' }}>{user.fullName}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user.role}</p>
                        </div>
                        <div style={{
                            width: '35px', height: '35px', background: 'var(--surface)',
                            borderRadius: '50%', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', border: '1px solid var(--border)'
                        }}>
                            <User size={20} color="var(--text-muted)" />
                        </div>
                    </div>
                    <button onClick={logout} className="btn" style={{ background: 'transparent', color: 'var(--error)', border: '1px solid var(--error)', padding: '0.5rem 1rem' }}>
                        <LogOut size={16} className="margin-right-mobile" />
                        <span className="hide-mobile">Salir</span>
                    </button>
                </div>
            </nav>

            {/* ── Main ───────────────────────────────────────────────── */}
            <main className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>

                {/* Header */}
                <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                            {showForm ? 'Nueva Cuenta de Cobro' : 'Panel de Control'}
                        </h1>
                        <p style={{ color: 'var(--text-muted)' }}>
                            {showForm
                                ? 'Completa los pasos para generar tu paquete mensual.'
                                : 'Bienvenido al sistema de la Alcaldía de Armenia.'}
                        </p>
                    </div>
                    {showForm && (
                        <button className="btn" onClick={() => setShowForm(false)} style={{ border: '1px solid var(--border)' }}>
                            Cancelar
                        </button>
                    )}
                </header>

                {showForm ? (
                    <BillingForm contract={contract} onComplete={handleFormComplete} />
                ) : (
                    <>
                        {/* ── Admin cards ─────────────────────────────────── */}
                        {user.role === 'admin' && (
                            <div style={{ marginBottom: '2.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <Shield size={20} color="var(--primary)" />
                                    <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Panel de Administración</h2>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                    <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)' }}>
                                        <Users size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                                        <h3 style={{ marginBottom: '0.5rem' }}>Directorio de Contratistas</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Consulta y gestiona los usuarios inscritos identificados por su número de cédula.</p>
                                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/admin/users')}>Ver Funcionarios</button>
                                    </div>
                                    <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)' }}>
                                        <Settings size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                                        <h3 style={{ marginBottom: '0.5rem' }}>Configurar Formatos</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Gestiona las plantillas de Word y PDF para las cuentas de cobro.</p>
                                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/admin/formats')}>Ir a Configuración</button>
                                    </div>
                                    <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)' }}>
                                        <FileText size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                                        <h3 style={{ marginBottom: '0.5rem' }}>Cuentas Pendientes</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Revisa las cuentas de cobro generadas por los contratistas.</p>
                                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/admin/accounts')}>Ver Cuentas</button>
                                    </div>
                                    <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)' }}>
                                        <Layers size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                                        <h3 style={{ marginBottom: '0.5rem' }}>Documentos y ZIPs</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Visualiza, descarga y elimina soportes o paquetes ZIP para su corrección.</p>
                                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/admin/documents')}>Gestionar Archivos</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Section header for personal contract and billing accounts */}
                        {user.role === 'admin' && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FileText size={20} color="var(--primary)" />
                                    <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Mis Cuentas de Cobro</h2>
                                </div>
                                <button 
                                    className="btn" 
                                    onClick={() => navigate('/contract-setup')}
                                    style={{ 
                                        background: 'transparent', 
                                        border: '1px solid var(--border)', 
                                        color: 'var(--text-main)', 
                                        fontSize: '0.825rem',
                                        padding: '0.4rem 0.8rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        cursor: 'pointer',
                                        borderRadius: 'var(--radius-md)'
                                    }}
                                >
                                    <Settings size={14} /> {contract ? 'Configuración de Mi Contrato' : 'Configurar Mi Contrato'}
                                </button>
                            </div>
                        )}

                        {/* ── Contractor cards & alerts (always available for both contractors and admin) ── */}
                        {/* Reminder Alert Banner: <= 5 days and 0 evidences */}
                                {reminderStatus?.needsReminder && (
                                    <div className="glass animate-fade-in" style={{
                                        padding: '1.25rem 1.5rem',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '2px solid var(--error)',
                                        background: 'rgba(239, 68, 68, 0.08)',
                                        marginBottom: '1.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '1rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ background: 'var(--error)', color: 'white', borderRadius: '50%', padding: '0.6rem', display: 'flex', flexShrink: 0 }}>
                                                <Clock size={24} />
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, color: 'var(--error)', fontSize: '1rem', fontWeight: 700 }}>
                                                    ¡Recordatorio de Entrega de Cuenta! (Acta N° {reminderStatus.actNumber})
                                                </h4>
                                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-main)', fontWeight: 500 }}>
                                                    {reminderStatus.message}
                                                </p>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    Periodo: {reminderStatus.period?.from} al {reminderStatus.period?.to} (Fecha de corte)
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            className="btn" 
                                            style={{ background: 'var(--error)', color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                            onClick={() => setShowForm(true)}
                                        >
                                            Cargar Evidencias Ahora <ChevronRight size={16} />
                                        </button>
                                    </div>
                                )}

                                {/* Alert: no contract */}
                                {!contract && (
                                    <div className="glass animate-fade-in" style={{
                                        padding: '1.5rem', borderRadius: 'var(--radius-lg)',
                                        boxShadow: 'var(--shadow)', border: '2px solid var(--accent)', marginBottom: '1.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                            <AlertCircle size={40} color="var(--accent)" />
                                            <div>
                                                <h3 style={{ color: 'var(--text-main)' }}>Configuración de Contrato Requerida</h3>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                                    Para comenzar a generar tus cuentas de cobro por el sistema, primero debes registrar o subir los datos de tu contrato base (minuta en PDF).
                                                </p>
                                            </div>
                                        </div>
                                        <button className="btn" onClick={() => navigate('/contract-setup')}
                                            style={{ background: 'var(--accent)', color: 'white', width: '100%', gap: '0.5rem' }}>
                                            Configurar Mi Contrato <ChevronRight size={18} />
                                        </button>
                                    </div>
                                )}

                                {/* ── Stat row ── */}
                                {contract && (activeCutoffInfo || cutoffInfo) && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                                        <StatCard
                                            icon={<Calendar size={28} />}
                                            label={`Corte Acta N° ${activeCutoffInfo ? activeCutoffInfo.actNumber : ''}: ${activeCutoffInfo ? activeCutoffInfo.date : cutoffInfo?.date}`}
                                            value={`${activeCutoffInfo ? activeCutoffInfo.days : cutoffInfo?.days} días`}
                                            accent={(activeCutoffInfo ? activeCutoffInfo.days : cutoffInfo?.days) <= 5 ? 'var(--error)' : (activeCutoffInfo ? activeCutoffInfo.days : cutoffInfo?.days) <= 10 ? 'var(--accent)' : 'var(--success)'}
                                        />
                                        <StatCard
                                            icon={<Package size={28} />}
                                            label="Historial de cuentas de cobro"
                                            value="Ver todo"
                                            accent="var(--primary)"
                                            onClick={() => navigate('/my-documents')}
                                        />
                                    </div>
                                )}

                                {/* ── Action cards ── */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                                    {/* Nueva cuenta */}
                                    <div className="glass" style={{
                                        padding: '2rem', borderRadius: 'var(--radius-lg)',
                                        boxShadow: 'var(--shadow)', opacity: !contract ? 0.55 : 1
                                    }}>
                                        <Upload size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                                        <h3 style={{ marginBottom: '0.5rem' }}>Nueva Cuenta de Cobro</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                                            Registra tus actividades del mes, evidencias y genera el paquete de 4 formatos + ZIP.
                                        </p>
                                        <button className="btn btn-primary" style={{ width: '100%' }}
                                            onClick={() => setShowForm(true)} disabled={!contract}>
                                            Comenzar Proceso
                                        </button>
                                    </div>

                                    {/* Mis documentos */}
                                    <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)' }}>
                                        <FileText size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                                        <h3 style={{ marginBottom: '0.5rem' }}>Mis Documentos</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                                            Descarga tus cuentas de cobro generadas anteriormente.
                                        </p>
                                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/my-documents')}>
                                            Ver Mis Archivos
                                        </button>
                                    </div>

                                    {/* Telegram */}
                                    <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)' }}>
                                        <MessageCircle size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                                        <h3 style={{ marginBottom: '0.5rem' }}>Vincular Telegram</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                                            Recibe notificaciones y descarga tu ZIP directamente en Telegram.
                                        </p>
                                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={generateTelegramCode}>
                                            Obtener Código de Vinculación
                                        </button>
                                    </div>
                                </div>

                                {/* Telegram code modal */}
                                {showTelegram && telegramCode && (
                                    <div style={{
                                        marginTop: '1.5rem', padding: '1.5rem',
                                        border: '2px solid var(--primary)', borderRadius: 'var(--radius-lg)',
                                        background: 'rgba(var(--primary-rgb,79,70,229),0.06)',
                                        textAlign: 'center', position: 'relative'
                                    }}>
                                        <button onClick={() => setShowTelegram(false)} style={{
                                            position: 'absolute', top: '0.75rem', right: '0.75rem',
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'var(--text-muted)', fontSize: '1.25rem', lineHeight: 1
                                        }}>×</button>
                                        <MessageCircle size={40} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                                        <h3 style={{ marginBottom: '0.5rem' }}>¡Código generado!</h3>
                                        <div style={{
                                            fontSize: '2.5rem', fontWeight: 900, letterSpacing: '0.5rem',
                                            color: 'var(--primary)', margin: '1rem 0', fontFamily: 'monospace'
                                        }}>
                                            {telegramCode}
                                        </div>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                                            Busca el bot en Telegram y envía el comando:<br />
                                            <code style={{ background: 'var(--surface)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>
                                                /start {telegramCode}
                                            </code>
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
            </main>
        </div>
    );
};

export default Dashboard;

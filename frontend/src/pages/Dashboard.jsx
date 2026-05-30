import React from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    LogOut, User, Settings, FileText, Upload, AlertCircle,
    ChevronRight, Calendar, MessageCircle, Package, Download
} from 'lucide-react';
import BillingForm from '../components/BillingForm';

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
                padding: '1.5rem', borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: '0.75rem',
                cursor: onClick ? 'pointer' : 'default',
                borderLeft: `4px solid ${accent || 'var(--primary)'}`,
                transition: 'transform 0.18s',
            }}
            onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
        >
            <div style={{ color: accent || 'var(--primary)' }}>{icon}</div>
            <div>
                <p style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1 }}>{value}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>{label}</p>
            </div>
        </div>
    );
}

const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [showForm, setShowForm]       = React.useState(false);
    const [contract, setContract]       = React.useState(null);
    const [telegramCode, setTelegramCode] = React.useState('');
    const [showTelegram, setShowTelegram] = React.useState(false);

    React.useEffect(() => {
        api.get('/contracts')
            .then(({ data }) => setContract(data))
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
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
                            </div>
                        )}

                        {/* ── Client cards ────────────────────────────────── */}
                        {user.role !== 'admin' && (
                            <>
                                {/* Alert: no contract */}
                                {!contract && (
                                    <div className="glass animate-fade-in" style={{
                                        padding: '1.5rem', borderRadius: 'var(--radius-lg)',
                                        boxShadow: 'var(--shadow)', border: '2px solid var(--accent)', marginBottom: '1.5rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                            <AlertCircle size={40} color="var(--accent)" />
                                            <div>
                                                <h3 style={{ color: 'var(--text-main)' }}>Configuración Requerida</h3>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                                    Debes configurar tu contrato base antes de generar cuentas de cobro.
                                                </p>
                                            </div>
                                        </div>
                                        <button className="btn" onClick={() => navigate('/contract-setup')}
                                            style={{ background: 'var(--accent)', color: 'white', width: '100%', gap: '0.5rem' }}>
                                            Configurar Ahora <ChevronRight size={18} />
                                        </button>
                                    </div>
                                )}

                                {/* ── Stat row ── */}
                                {contract && cutoffInfo && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                                        <StatCard
                                            icon={<Calendar size={28} />}
                                            label={`Fecha de corte: ${cutoffInfo.date}`}
                                            value={`${cutoffInfo.days} días`}
                                            accent={cutoffInfo.days <= 5 ? 'var(--error)' : cutoffInfo.days <= 10 ? 'var(--accent)' : 'var(--success)'}
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
                    </>
                )}
            </main>
        </div>
    );
};

export default Dashboard;

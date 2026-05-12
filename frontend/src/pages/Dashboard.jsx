import React from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Settings, FileText, Upload, AlertCircle, ChevronRight } from 'lucide-react';
import EvidenceForm from '../components/EvidenceForm';

const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showForm, setShowForm] = React.useState(false);
    const [contract, setContract] = React.useState(null);

    React.useEffect(() => {
        const fetchContract = async () => {
            try {
                const { data } = await api.get('/contracts');
                setContract(data);
            } catch (err) {
                // Not set up yet
            }
        };
        fetchContract();
    }, []);

    const handleFormComplete = (data) => {
        console.log('Formulario completado:', data);
        alert('Evidencias enviadas correctamente (Simulación)');
        setShowForm(false);
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--text-main)', transition: 'background 0.3s, color 0.3s' }}>
            <nav className="glass" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
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
                        <div style={{ width: '35px', height: '35px', background: 'var(--surface)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                            <User size={20} color="var(--text-muted)" />
                        </div>
                    </div>
                    <button onClick={logout} className="btn" style={{ background: 'transparent', color: 'var(--error)', border: '1px solid var(--error)', padding: '0.5rem 1rem' }}>
                        <LogOut size={16} className="margin-right-mobile" />
                        <span className="hide-mobile">Salir</span>
                    </button>
                </div>
            </nav>

            <main className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
                <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{showForm ? 'Nueva Cuenta de Cobro' : 'Panel de Control'}</h1>
                        <p style={{ color: 'var(--text-muted)' }}>{showForm ? 'Completa los pasos para generar tu documento.' : 'Bienvenido al sistema de la Alcaldía de Armenia.'}</p>
                    </div>
                    {showForm && (
                        <button className="btn" onClick={() => setShowForm(false)} style={{ border: '1px solid var(--border)' }}>
                            Cancelar
                        </button>
                    )}
                </header>

                {showForm ? (
                    <EvidenceForm onComplete={handleFormComplete} />
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        {user.role === 'admin' ? (
                            <>
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
                            </>
                        ) : (
                            <>
                                {!contract && (
                                    <div className="glass animate-fade-in" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', border: '2px solid var(--accent)', gridColumn: '1 / -1' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                            <AlertCircle size={40} color="var(--accent)" />
                                            <div>
                                                <h3 style={{ color: 'var(--text-main)' }}>Configuración Requerida</h3>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Debes configurar tu contrato base antes de generar cuentas de cobro.</p>
                                            </div>
                                        </div>
                                        <button className="btn" onClick={() => navigate('/contract-setup')} style={{ background: 'var(--accent)', color: 'white', width: '100%', gap: '0.5rem' }}>
                                            Configurar Ahora <ChevronRight size={18} />
                                        </button>
                                    </div>
                                )}
                                <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', opacity: !contract ? 0.6 : 1 }}>
                                    <Upload size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                                    <h3 style={{ marginBottom: '0.5rem' }}>Nueva Cuenta de Cobro</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Sube tus evidencias y genera tu cuenta de cobro automáticamente.</p>
                                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowForm(true)} disabled={!contract}>Comenzar Proceso</button>
                                </div>
                                <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)' }}>
                                    <FileText size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                                    <h3 style={{ marginBottom: '0.5rem' }}>Mis Documentos</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Descarga tus cuentas de cobro generadas anteriormente.</p>
                                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/my-documents')}>Ver Mis Archivos</button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;

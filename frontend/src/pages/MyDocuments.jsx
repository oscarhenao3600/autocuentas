import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { motion } from 'framer-motion';
import { FileText, Download, Clock, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MyDocuments = () => {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            const { data } = await api.get('/accounts/my-accounts');
            setAccounts(data);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved': return <CheckCircle color="var(--success)" />;
            case 'rejected': return <XCircle color="var(--error)" />;
            default: return <Clock color="var(--accent)" />;
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'approved': return 'Aprobado';
            case 'rejected': return 'Rechazado';
            default: return 'Pendiente';
        }
    };

    return (
        <div className="container" style={{ padding: '2rem 0' }}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
            >
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
                <header style={{ marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <FileText color="var(--primary)" />
                        Mis Documentos
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Historial de tus cuentas de cobro generadas.</p>
                </header>

                {loading ? (
                    <p>Cargando documentos...</p>
                ) : accounts.length === 0 ? (
                    <div className="glass flex-center" style={{ padding: '3rem', flexDirection: 'column', gap: '1rem', borderRadius: 'var(--radius-lg)' }}>
                        <FileText size={48} color="var(--text-muted)" />
                        <p style={{ color: 'var(--text-muted)' }}>Aún no has generado ninguna cuenta de cobro.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        {accounts.map(account => (
                            <div key={account._id} className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        {new Date(account.createdAt).toLocaleDateString()}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                                        {getStatusIcon(account.status)}
                                        {getStatusText(account.status)}
                                    </div>
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>{account.activity}</h3>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {account.description || 'Sin descripción'}
                                    </p>
                                </div>
                                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                                    {account.generatedDocumentPath ? (
                                        <a 
                                            href={`/generated/${account.generatedDocumentPath.split(/\\|\//).pop()}`} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="btn btn-primary" 
                                            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                                        >
                                            <Download size={18} />
                                            Descargar Cuenta (.docx)
                                        </a>
                                    ) : (
                                        <button className="btn" disabled style={{ width: '100%' }}>Documento no disponible</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default MyDocuments;

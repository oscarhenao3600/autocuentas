import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { motion } from 'framer-motion';
import { FileText, CheckCircle, XCircle, Search, Clock, Eye, Download } from 'lucide-react';

const PendingAccounts = () => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            const { data } = await api.get('/admin/accounts');
            setAccounts(data);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id, status) => {
        try {
            await api.put(`/admin/accounts/${id}/status`, { status });
            // Update local state
            setAccounts(accounts.map(acc => acc._id === id ? { ...acc, status } : acc));
        } catch (error) {
            alert('Error al actualizar estado');
        }
    };

    const filteredAccounts = accounts.filter(acc => 
        acc.user?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        acc.activity.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container" style={{ padding: '2rem 0' }}>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <header style={{ marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <FileText color="var(--primary)" />
                        Cuentas Pendientes
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Revisa y gestiona las cuentas de cobro de los contratistas.</p>
                </header>

                <div className="form-group" style={{ marginBottom: '2rem', position: 'relative' }}>
                    <Search size={20} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                        type="text" 
                        className="input" 
                        placeholder="Buscar por nombre o actividad..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '3rem' }}
                    />
                </div>

                {loading ? (
                    <p>Cargando cuentas...</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                            <thead style={{ background: 'rgba(37, 99, 235, 0.1)', textAlign: 'left' }}>
                                <tr>
                                    <th style={{ padding: '1rem' }}>Contratista</th>
                                    <th style={{ padding: '1rem' }}>Actividad</th>
                                    <th style={{ padding: '1rem' }}>Fecha</th>
                                    <th style={{ padding: '1rem' }}>Evidencias</th>
                                    <th style={{ padding: '1rem' }}>Estado</th>
                                    <th style={{ padding: '1rem' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAccounts.map(account => (
                                    <tr key={account._id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <p style={{ fontWeight: '600' }}>{account.user?.fullName}</p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{account.user?.email}</p>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <p>{account.activity}</p>
                                        </td>
                                        <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                                            {new Date(account.createdAt).toLocaleDateString()}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                {account.evidences?.map((ev, i) => (
                                                    <a key={i} href={`/uploads/${ev.path.split(/\\|\//).pop()}`} target="_blank" rel="noreferrer" title={ev.filename} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', background: 'var(--background)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                                        <Eye size={14} /> Ver
                                                    </a>
                                                ))}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            {account.status === 'pending' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent)', background: 'rgba(245, 158, 11, 0.1)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem' }}><Clock size={14}/> Pendiente</span>}
                                            {account.status === 'approved' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem' }}><CheckCircle size={14}/> Aprobado</span>}
                                            {account.status === 'rejected' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem' }}><XCircle size={14}/> Rechazado</span>}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            {account.status === 'pending' && (
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--success)', color: 'white', border: 'none' }} onClick={() => updateStatus(account._id, 'approved')}>
                                                        Aprobar
                                                    </button>
                                                    <button className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--error)', color: 'white', border: 'none' }} onClick={() => updateStatus(account._id, 'rejected')}>
                                                        Rechazar
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredAccounts.length === 0 && (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay cuentas para mostrar.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default PendingAccounts;

import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { motion } from 'framer-motion';
import { FileUp, Save, CheckCircle, AlertCircle, Loader2, FileText, Info, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ContractSetup = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [contract, setContract] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchContract();
    }, []);

    const fetchContract = async () => {
        try {
            const { data } = await api.get('/contracts');
            setContract(data);
        } catch (err) {
            // No contract found yet, that's fine
        }
    };

    const handleBaseUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('contractFile', file);

        setExtracting(true);
        setError('');
        try {
            const { data } = await api.post('/contracts/upload-base', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data'
                }
            });
            setContract(data.data);
            setSuccess('Contrato procesado por IA con éxito. Por favor verifique los datos.');
        } catch (err) {
            setError('Error al procesar el contrato: ' + (err.response?.data?.message || err.message));
        } finally {
            setExtracting(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const { data } = await api.put('/contracts', contract);
            setContract(data.data);
            setSuccess('Datos del contrato guardados correctamente en la base de datos.');
        } catch (err) {
            setError('Error al guardar datos del contrato: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleAttachmentUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append(type, file);

        try {
            const { data } = await api.post('/contracts/upload-attachments', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setContract(data.data);
            setSuccess('Anexo subido correctamente.');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError('Error al subir anexo: ' + (err.response?.data?.message || err.message));
        }
    };

    return (
        <div className="container" style={{ padding: '2rem 0' }}>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass"
                style={{ padding: '2.5rem', borderRadius: 'var(--radius-lg)' }}
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
                        Configuración de Contrato Base
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Sube tu minuta de contrato para que la IA extraiga los datos automáticamente.</p>
                </header>

                {!contract && !extracting && (
                    <div className="flex-center" style={{ height: '200px', border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', flexDirection: 'column', gap: '1rem' }}>
                        <FileUp size={48} color="var(--text-muted)" />
                        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                            Subir Minuta del Contrato (PDF)
                            <input type="file" style={{ display: 'none' }} onChange={handleBaseUpload} accept=".pdf" />
                        </label>
                    </div>
                )}

                {extracting && (
                    <div className="flex-center" style={{ height: '200px', flexDirection: 'column', gap: '1rem' }}>
                        <Loader2 size={48} color="var(--primary)" className="animate-spin" />
                        <p style={{ fontWeight: '600' }}>La IA está procesando tu contrato...</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Esto puede tardar unos segundos.</p>
                    </div>
                )}

                {contract && !extracting && (
                    <form onSubmit={handleSave}>
                        <div style={{ background: 'rgba(37, 99, 235, 0.05)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid var(--primary)' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Info size={18} color="var(--primary)" />
                                Datos Extraídos por IA
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="label">Nombre del Contratista</label>
                                    <input className="input" value={contract.contractorName || ''} onChange={(e) => setContract({...contract, contractorName: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Cédula / NIT</label>
                                    <input className="input" value={contract.idNumber || ''} onChange={(e) => setContract({...contract, idNumber: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Número de Contrato</label>
                                    <input className="input" value={contract.contractNumber || ''} onChange={(e) => setContract({...contract, contractNumber: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Valor Mensual</label>
                                    <input className="input" type="number" value={contract.monthlyValue || ''} onChange={(e) => setContract({...contract, monthlyValue: e.target.value})} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label className="label">Objeto del Contrato</label>
                                <textarea className="input" rows="3" value={contract.contractObject || ''} onChange={(e) => setContract({...contract, contractObject: e.target.value})} />
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Otros Documentos Requeridos</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>RUT Actualizado</p>
                                    <label className="btn" style={{ fontSize: '0.75rem', border: '1px solid var(--primary)', color: 'var(--primary)', cursor: 'pointer', display: 'inline-block' }}>
                                        {contract.rutPath ? <><CheckCircle size={14} style={{display:'inline', marginRight:'4px'}}/> Actualizar</> : 'Subir PDF'}
                                        <input type="file" style={{ display: 'none' }} onChange={(e) => handleAttachmentUpload(e, 'rut')} accept=".pdf" />
                                    </label>
                                </div>
                                <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Certificado Bancario</p>
                                    <label className="btn" style={{ fontSize: '0.75rem', border: '1px solid var(--primary)', color: 'var(--primary)', cursor: 'pointer', display: 'inline-block' }}>
                                        {contract.bankCertificatePath ? <><CheckCircle size={14} style={{display:'inline', marginRight:'4px'}}/> Actualizar</> : 'Subir PDF'}
                                        <input type="file" style={{ display: 'none' }} onChange={(e) => handleAttachmentUpload(e, 'bankCertificate')} accept=".pdf,.jpg,.jpeg,.png" />
                                    </label>
                                </div>
                                <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Seguridad Social</p>
                                    <label className="btn" style={{ fontSize: '0.75rem', border: '1px solid var(--primary)', color: 'var(--primary)', cursor: 'pointer', display: 'inline-block' }}>
                                        {contract.securitySocialPath ? <><CheckCircle size={14} style={{display:'inline', marginRight:'4px'}}/> Actualizar</> : 'Subir PDF'}
                                        <input type="file" style={{ display: 'none' }} onChange={(e) => handleAttachmentUpload(e, 'securitySocial')} accept=".pdf" />
                                    </label>
                                </div>
                            </div>
                        </div>

                        {success && <p style={{ color: 'var(--success)', marginBottom: '1rem', fontSize: '0.875rem' }}>{success}</p>}
                        {error && <p style={{ color: 'var(--error)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button type="submit" className="btn btn-primary" disabled={loading} style={{ gap: '0.5rem' }}>
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Guardar y Confirmar Datos
                            </button>
                            <label className="btn" style={{ border: '1px solid var(--border)', cursor: 'pointer' }}>
                                Cambiar Minuta
                                <input type="file" style={{ display: 'none' }} onChange={handleBaseUpload} accept=".pdf" />
                            </label>
                        </div>
                    </form>
                )}
            </motion.div>
        </div>
    );
};

export default ContractSetup;

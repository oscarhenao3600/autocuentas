import React, { useState } from 'react';
import api from '../utils/api';
import { motion } from 'framer-motion';
import { Settings, Upload, File, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ConfigureFormats = () => {
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('templateFile', file);

        try {
            const { data } = await api.post('/admin/template', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setMessage(data.message);
            setFile(null);
        } catch (error) {
            setMessage('Error al subir plantilla: ' + (error.response?.data?.message || error.message));
        } finally {
            setUploading(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    return (
        <div className="container" style={{ padding: '2rem 0' }}>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass" style={{ padding: '2.5rem', borderRadius: 'var(--radius-lg)' }}>
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
                        <Settings color="var(--primary)" />
                        Configurar Formatos Maestros
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Actualiza la plantilla base de Word (.docx) que se usará para generar las cuentas de cobro de la Alcaldía.</p>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '500px' }}>
                    <div style={{ padding: '1.5rem', border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                        <Upload size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                        <h3 style={{ marginBottom: '0.5rem' }}>Subir Nueva Plantilla (.docx)</h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Asegúrate de que la plantilla contenga las etiquetas correctas (ej. {`{contractorName}`}, {`{activity}`}).
                        </p>
                        <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                            Seleccionar Archivo
                            <input type="file" style={{ display: 'none' }} accept=".docx" onChange={handleFileChange} />
                        </label>
                        {file && (
                            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                                <File size={16} /> {file.name}
                            </div>
                        )}
                    </div>

                    <button className="btn btn-primary" style={{ width: '100%', background: 'var(--success)' }} disabled={!file || uploading} onClick={handleUpload}>
                        {uploading ? 'Subiendo...' : 'Guardar y Aplicar Plantilla'}
                    </button>

                    {message && (
                        <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle size={18} /> {message}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default ConfigureFormats;

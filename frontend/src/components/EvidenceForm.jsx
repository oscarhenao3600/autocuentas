import React, { useState } from 'react';
import api from '../utils/api';
import { filterSpecificObligations } from '../utils/period.utils';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Upload, ChevronRight, ChevronLeft, FileText, Calendar, Plus, Trash2, Sparkles } from 'lucide-react';

const EvidenceForm = ({ onComplete, contract }) => {
    const [step, setStep] = useState(1);
    const [improving, setImproving] = useState(false);
    const [formData, setFormData] = useState({
        activity: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        files: []
    });

    const handleImproveDescription = async () => {
        if (!formData.description || !formData.description.trim()) {
            alert('Por favor escribe primero una idea o breve descripción para que la IA pueda enriquecerla.');
            return;
        }
        setImproving(true);
        try {
            const { data } = await api.post('/billing/improve-evidence-text', {
                rawText: formData.description,
                obligationText: formData.activity || ''
            });
            if (data.improvedText) {
                setFormData(prev => ({ ...prev, description: data.improvedText }));
            }
        } catch (err) {
            console.error('Error mejorando texto:', err);
            alert('No se pudo mejorar el texto con IA: ' + (err.response?.data?.message || err.message));
        } finally {
            setImproving(false);
        }
    };

    const activities = filterSpecificObligations(contract?.activities || []);

    const nextStep = () => setStep(s => s + 1);
    const prevStep = () => setStep(s => s - 1);

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFormData(prev => ({
            ...prev,
            files: [...prev.files, ...selectedFiles]
        }));
    };

    const removeFile = (index) => {
        setFormData(prev => ({
            ...prev,
            files: prev.files.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const formDataToSend = new FormData();
        formDataToSend.append('activity', formData.activity);
        formDataToSend.append('date', formData.date);
        formDataToSend.append('description', formData.description);
        
        formData.files.forEach(file => {
            formDataToSend.append('files', file);
        });

        try {
            const response = await api.post('/accounts', formDataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            onComplete(response.data);
        } catch (error) {
            alert('Error al subir evidencias: ' + (error.response?.data?.message || error.message));
        }
    };

    const stepVariants = {
        enter: { x: 20, opacity: 0 },
        center: { x: 0, opacity: 1 },
        exit: { x: -20, opacity: 0 }
    };

    return (
        <div className="glass" style={{ width: '100%', maxWidth: '700px', margin: '0 auto', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {/* Progress Bar */}
            <div style={{ height: '4px', background: 'var(--border)', width: '100%' }}>
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(step / 3) * 100}%` }}
                    style={{ height: '100%', background: 'var(--primary)' }}
                />
            </div>

            <div style={{ padding: '2rem' }}>
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div 
                            key="step1"
                            variants={stepVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                        >
                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={24} color="var(--primary)" />
                                Paso 1: Actividad y Fecha
                            </h2>
                            <div className="form-group">
                                <label className="label">Selecciona la Actividad</label>
                                <select 
                                    className="input" 
                                    value={formData.activity}
                                    onChange={(e) => setFormData({...formData, activity: e.target.value})}
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {activities.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                                {activities.length === 0 && (
                                    <p style={{ color: 'var(--error)', fontSize: '0.825rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        ⚠️ No has configurado actividades en tu minuta. Ve a "Configuración de Contrato Base" para agregarlas.
                                    </p>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="label">Fecha de Realización</label>
                                <input 
                                    type="date" 
                                    className="input" 
                                    value={formData.date}
                                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                                />
                            </div>
                            <button 
                                className="btn btn-primary" 
                                style={{ width: '100%', marginTop: '1rem' }}
                                onClick={nextStep}
                                disabled={!formData.activity}
                            >
                                Continuar <ChevronRight size={18} />
                            </button>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div 
                            key="step2"
                            variants={stepVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                        >
                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Upload size={24} color="var(--primary)" />
                                Paso 2: Subida de Evidencias
                            </h2>
                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <label className="label" style={{ margin: 0 }}>Descripción Breve de la Actividad</label>
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={handleImproveDescription}
                                        disabled={improving || !formData.description?.trim()}
                                        title="Mejora tu idea redactando una descripción técnica formal (30 a 50 palabras)"
                                        style={{
                                            fontSize: '0.75rem',
                                            padding: '0.25rem 0.65rem',
                                            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            cursor: improving || !formData.description?.trim() ? 'not-allowed' : 'pointer',
                                            opacity: !formData.description?.trim() ? 0.6 : 1
                                        }}
                                    >
                                        <Sparkles size={13} />
                                        {improving ? 'Redactando con IA...' : '✨ Mejorar con IA (30-50 palabras)'}
                                    </button>
                                </div>
                                <textarea 
                                    className="input" 
                                    rows="3"
                                    placeholder="Describe brevemente la idea de la actividad y presiona 'Mejorar con IA'..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                                    {(() => {
                                        const count = formData.description ? formData.description.trim().split(/\s+/).filter(Boolean).length : 0;
                                        const inRange = count >= 30 && count <= 50;
                                        return (
                                            <span style={{
                                                fontSize: '0.72rem',
                                                color: inRange ? 'var(--success)' : 'var(--text-muted)',
                                                fontWeight: inRange ? 600 : 400
                                            }}>
                                                {count} palabras {inRange ? '✓ (rango ideal)' : ''}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                            
                            <div 
                                style={{ 
                                    border: '2px dashed var(--border)', 
                                    borderRadius: 'var(--radius-md)', 
                                    padding: '2rem', 
                                    textAlign: 'center',
                                    marginBottom: '1rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                                onClick={() => document.getElementById('file-upload').click()}
                            >
                                <Upload size={40} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                                <p style={{ color: 'var(--text-muted)' }}>Haz clic o arrastra archivos aquí</p>
                                <input 
                                    id="file-upload"
                                    type="file" 
                                    multiple 
                                    style={{ display: 'none' }} 
                                    onChange={handleFileChange}
                                />
                            </div>

                            {formData.files.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Archivos Seleccionados:</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {formData.files.map((file, i) => (
                                            <div key={i} className="flex-center" style={{ justifyContent: 'space-between', padding: '0.5rem', background: 'var(--background)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                                <div className="flex-center" style={{ gap: '0.5rem' }}>
                                                    <FileText size={16} color="var(--primary)" />
                                                    <span style={{ fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{file.name}</span>
                                                </div>
                                                <button onClick={() => removeFile(i)} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={prevStep}>
                                    Atrás
                                </button>
                                <button className="btn btn-primary" style={{ flex: 2 }} onClick={nextStep} disabled={formData.files.length === 0}>
                                    Revisar <ChevronRight size={18} />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div 
                            key="step3"
                            variants={stepVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                        >
                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle2 size={24} color="var(--success)" />
                                Paso 3: Confirmar y Enviar
                            </h2>
                            
                            <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                                <p style={{ marginBottom: '0.5rem' }}><strong>Actividad:</strong> {formData.activity}</p>
                                <p style={{ marginBottom: '0.5rem' }}><strong>Fecha:</strong> {formData.date}</p>
                                <p style={{ marginBottom: '0.5rem' }}><strong>Descripción:</strong> {formData.description || 'Sin descripción'}</p>
                                <p><strong>Archivos:</strong> {formData.files.length} adjuntos</p>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={prevStep}>
                                    Corregir
                                </button>
                                <button className="btn btn-primary" style={{ flex: 2, background: 'var(--success)' }} onClick={handleSubmit}>
                                    Enviar Evidencias
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default EvidenceForm;

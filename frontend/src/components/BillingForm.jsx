import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { calculatePeriods, filterSpecificObligations } from '../utils/period.utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2, Upload, ChevronRight, ChevronLeft, FileText,
    Shield, Plus, Trash2, AlertCircle, Package, Download,
    MessageCircle, Clock, RefreshCw, Lock, Eye, EyeOff, X
} from 'lucide-react';

const STEP_LABELS = [
    'Periodo',
    'Actividades',
    'Seguridad Social',
    'Confirmar y Generar'
];

const stepVariants = {
    enter:  { x: 40, opacity: 0 },
    center: { x: 0,  opacity: 1 },
    exit:   { x: -40, opacity: 0 }
};

// ─── Small helpers ────────────────────────────────────────────
function FileChip({ file, onRemove }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.4rem 0.75rem',
            background: 'var(--background)', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', fontSize: '0.8rem'
        }}>
            <FileText size={14} color="var(--primary)" />
            <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
            </span>
            <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', lineHeight: 1 }}>
                <Trash2 size={13} />
            </button>
        </div>
    );
}

function DropZone({ id, onFiles }) {
    const [hover, setHover] = useState(false);
    const handleDrop = (e) => {
        e.preventDefault(); setHover(false);
        onFiles(Array.from(e.dataTransfer.files));
    };
    return (
        <div
            onDragOver={e => { e.preventDefault(); setHover(true); }}
            onDragLeave={() => setHover(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById(id).click()}
            style={{
                border: `2px dashed ${hover ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)', padding: '1.25rem',
                textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
                background: hover ? 'rgba(var(--primary-rgb),0.04)' : 'transparent'
            }}
        >
            <Upload size={22} color="var(--text-muted)" style={{ marginBottom: '0.4rem' }} />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Arrastra archivos o haz clic
            </p>
            <input id={id} type="file" multiple style={{ display: 'none' }}
                accept="image/*,.pdf,.doc,.docx"
                onChange={e => onFiles(Array.from(e.target.files))} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
export default function BillingForm({ contract, onComplete }) {
    const today = new Date();
    const cutoff = contract?.cutoffDay || 25;

    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [periodId, setPeriodId] = useState(null);
    const [result, setResult]   = useState(null);
    const [error, setError]     = useState('');
    const [success, setSuccess] = useState('');
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [docPassword, setDocPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [unlockingDoc, setUnlockingDoc] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [selectedAct, setSelectedAct] = useState(1);
    const [periodData, setPeriodData] = useState({
        periodFrom: '',
        periodTo: '',
        actNumber: 1
    });

    const periodsList = React.useMemo(() => {
        if (!contract) return [];
        return calculatePeriods(
            contract.startDate,
            contract.initialDurationMonths || 4,
            contract.additionDurationMonths || 0,
            contract.periodType || 'mes_cumplido',
            contract.endDate
        );
    }, [contract]);

    React.useEffect(() => {
        if (periodsList.length > 0) {
            const current = periodsList.find(p => p.actNumber === selectedAct) || periodsList[0];
            setPeriodData({
                periodFrom: current.from,
                periodTo: current.to,
                actNumber: current.actNumber
            });
        }
    }, [selectedAct, periodsList]);


    // Build initial activities from contract specific obligations only
    const [activities, setActivities] = useState(
        filterSpecificObligations(contract?.activities || []).map((text, i) => ({
            obligationCode: `2.2.${i + 1}`,
            obligationText: text,
            comment: '',
            files: []
        }))
    );

        const [ss, setSs] = useState({
        operator: '', planillaNumber: '', totalPaid: '',
        saludPaid: '', pensionPaid: '', arlPaid: '', period: ''
    });

    const [uploadingPlanilla, setUploadingPlanilla] = useState(false);
    const [planillaPath, setPlanillaPath] = useState(contract?.securitySocialPath || '');
    const [planillaFile, setPlanillaFile] = useState(null);

    const handlePlanillaUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setPlanillaFile(file);

        const formData = new FormData();
        formData.append('planillaFile', file);
        if (contract?._id) {
            formData.append('contractId', contract._id);
        }

        setUploadingPlanilla(true);
        setError('');
        setSuccess('');
        try {
            const { data } = await api.post('/billing/upload-planilla', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (data.filePath) {
                setPlanillaPath(data.filePath);
            }

            if (data.requiresPassword) {
                setPasswordModalOpen(true);
                setDocPassword('');
                setPasswordError(data.message || 'La planilla de seguridad social está protegida con contraseña.');
                return;
            }

            const ext = data.data;
            if (ext) {
                setSs({
                    operator: ext.operator || '',
                    planillaNumber: ext.planillaNumber || '',
                    period: ext.period || '',
                    totalPaid: ext.totalPaid || '',
                    saludPaid: ext.saludPaid || '',
                    pensionPaid: ext.pensionPaid || '',
                    arlPaid: ext.arlPaid || ''
                });
            }
            setSuccess(data.message || 'Planilla procesada con éxito por la IA.');
            setTimeout(() => setSuccess(''), 6000);
        } catch (err) {
            setError('Error al procesar la planilla de seguridad social: ' + (err.response?.data?.message || err.message));
        } finally {
            setUploadingPlanilla(false);
        }
    };

    const handleUnlockPlanillaSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!docPassword.trim()) {
            setPasswordError('Por favor ingresa la contraseña de la planilla.');
            return;
        }

        setUnlockingDoc(true);
        setPasswordError('');

        try {
            const { data } = await api.post('/billing/unlock-planilla', {
                password: docPassword.trim(),
                contractId: contract?._id,
                filePath: planillaPath
            });

            if (data.filePath) {
                setPlanillaPath(data.filePath);
            }
            if (data.data) {
                const ext = data.data;
                setSs({
                    operator: ext.operator || '',
                    planillaNumber: ext.planillaNumber || '',
                    period: ext.period || '',
                    totalPaid: ext.totalPaid || '',
                    saludPaid: ext.saludPaid || '',
                    pensionPaid: ext.pensionPaid || '',
                    arlPaid: ext.arlPaid || ''
                });
            }

            setPasswordModalOpen(false);
            setDocPassword('');
            setSuccess(data.message || '¡Planilla desbloqueada y procesada por IA con éxito!');
            setTimeout(() => setSuccess(''), 6000);
        } catch (err) {
            setPasswordError(err.response?.data?.message || 'Error al desbloquear la planilla. Verifica la contraseña.');
        } finally {
            setUnlockingDoc(false);
        }
    };

    // ── Step navigation ─────────────────────────────────────
    const next = () => setStep(s => Math.min(s + 1, 4));
    const prev = () => setStep(s => Math.max(s - 1, 1));

    const [improvingIdx, setImprovingIdx] = useState(null);

    const handleImproveComment = async (idx) => {
        const rawText = activities[idx]?.comment;
        if (!rawText || !rawText.trim()) {
            alert('Por favor escribe primero una idea o breve descripción para que la IA pueda enriquecerla.');
            return;
        }
        setImprovingIdx(idx);
        try {
            const { data } = await api.post('/billing/improve-evidence-text', {
                rawText: rawText,
                obligationText: activities[idx]?.obligationText || ''
            });
            if (data.improvedText) {
                updateActivity(idx, 'comment', data.improvedText);
            }
        } catch (err) {
            console.error('Error mejorando texto:', err);
            alert('No se pudo mejorar el texto con IA: ' + (err.response?.data?.message || err.message));
        } finally {
            setImprovingIdx(null);
        }
    };

    const updateActivity = (idx, field, value) => {
        setActivities(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
    };

    const addFiles = (idx, files) => {
        setActivities(prev => prev.map((a, i) => i === idx ? { ...a, files: [...a.files, ...files] } : a));
    };

    const removeFile = (actIdx, fileIdx) => {
        setActivities(prev => prev.map((a, i) =>
            i === actIdx ? { ...a, files: a.files.filter((_, fi) => fi !== fileIdx) } : a
        ));
    };

    // ── Save draft then generate ─────────────────────────────
    const saveDraft = async () => {
        setSaving(true); setError('');
        try {
            const fd = new FormData();
            fd.append('periodFrom',    periodData.periodFrom);
            fd.append('periodTo',      periodData.periodTo);
            fd.append('actNumber',     periodData.actNumber);
            fd.append('activities',    JSON.stringify(
                activities.map(a => ({
                    obligationCode: a.obligationCode,
                    obligationText: a.obligationText,
                    comment: a.comment
                }))
            ));
            fd.append('securitySocial', JSON.stringify(ss));
            if (planillaPath) {
                fd.append('securitySocialPath', planillaPath);
            }
            if (planillaFile) {
                fd.append('securitySocialFile', planillaFile);
            }

            // Attach evidence files per activity index
            activities.forEach((act, idx) => {
                act.files.forEach(f => fd.append(`evidence_${idx}`, f));
            });

            const { data } = await api.post('/billing', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setPeriodId(data.data._id);
            return data.data._id;
        } catch (err) {
            setError(err.response?.data?.message || 'Error al guardar el borrador');
            return null;
        } finally {
            setSaving(false);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true); setError('');
        try {
            let id = periodId;
            if (!id) id = await saveDraft();
            if (!id) return;

            const { data } = await api.post(`/billing/${id}/generate`);
            setResult(data);
            next(); // go to success step
        } catch (err) {
            setError(err.response?.data?.message || 'Error al generar el paquete');
        } finally {
            setGenerating(false);
        }
    };

    const handleDownload = async () => {
        if (!result) return;
        window.open(`${import.meta.env.VITE_API_URL || '/api'}${result.zipUrl.replace('/generated/', '/generated/')}`, '_blank');
    };

    // ── Validation ──────────────────────────────────────────
    const step2Valid = activities.every(a => a.comment.trim().length > 0);
    const step3Valid = ss.operator && ss.planillaNumber && ss.totalPaid;

    // ─────────────────────────────────────────────────────────
    return (
        <div className="glass" style={{
            width: '100%', maxWidth: '760px', margin: '0 auto',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden'
        }}>
            {/* Progress bar */}
            <div style={{ height: '4px', background: 'var(--border)' }}>
                <motion.div
                    animate={{ width: `${((step - 1) / (STEP_LABELS.length - 1)) * 100}%` }}
                    style={{ height: '100%', background: 'var(--primary)', transition: 'width 0.4s ease' }}
                />
            </div>

            {/* Step indicator */}
            <div style={{
                display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
                overflowX: 'auto'
            }}>
                {STEP_LABELS.map((label, i) => (
                    <div key={i} style={{
                        flex: 1, padding: '0.75rem 0.5rem', textAlign: 'center',
                        fontSize: '0.75rem', fontWeight: step === i + 1 ? 700 : 400,
                        color: step === i + 1 ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: step === i + 1 ? '2px solid var(--primary)' : '2px solid transparent',
                        transition: 'all 0.2s', whiteSpace: 'nowrap'
                    }}>
                        {i + 1}. {label}
                    </div>
                ))}
            </div>

            <div style={{ padding: '2rem' }}>
                {error && (
                    <div style={{
                        display: 'flex', gap: '0.75rem', alignItems: 'center',
                        padding: '0.875rem 1rem', background: 'rgba(239,68,68,0.1)',
                        border: '1px solid var(--error)', borderRadius: 'var(--radius-md)',
                        marginBottom: '1.5rem', color: 'var(--error)', fontSize: '0.875rem'
                    }}>
                        <AlertCircle size={18} /> {error}
                    </div>
                )}

                <AnimatePresence mode="wait">

                    {/* ── STEP 1: Periodo ─────────────────────────────────── */}
                    {step === 1 && (
                        <motion.div key="step1" variants={stepVariants} initial="enter" animate="center" exit="exit">
                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Clock size={22} color="var(--primary)" /> Periodo de Cobro
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="label">Selecciona el Acta (Cuenta de Cobro) a Generar</label>
                                    <select 
                                        className="input" 
                                        value={selectedAct} 
                                        onChange={(e) => setSelectedAct(parseInt(e.target.value))}
                                        style={{ fontWeight: '600' }}
                                    >
                                        {periodsList.map((p) => (
                                            <option key={p.actNumber} value={p.actNumber}>
                                                Acta N° {p.actNumber} {p.isAddition ? '(Adición Contractual)' : '(Contrato Inicial)'} ({p.from} al {p.to})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Desde</label>
                                    <input type="date" className="input" readOnly value={periodData.periodFrom}
                                        style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Hasta (Fecha de Corte)</label>
                                    <input type="date" className="input" readOnly value={periodData.periodTo}
                                        style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                                </div>

                                {periodsList.find(p => p.actNumber === selectedAct)?.isAddition && (
                                    <div style={{
                                        gridColumn: '1 / -1',
                                        padding: '1rem',
                                        background: 'rgba(234,179,8,0.1)',
                                        border: '1px solid var(--accent)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: '0.85rem',
                                        color: 'var(--text-main)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        marginTop: '0.5rem'
                                    }}>
                                        <AlertCircle size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
                                        <span>
                                            <strong>¡Atención!</strong> Esta cuenta de cobro corresponde al periodo de <strong>Adición Contractual</strong>. Los formatos automáticos incluirán la información presupuestal modificada (RP Adición: <strong>{contract.additionRp || 'Falta cargar'}</strong>, CDP Adición: <strong>{contract.additionCdp || 'Falta cargar'}</strong>).
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div style={{
                                padding: '1rem', background: 'rgba(var(--primary-rgb,79,70,229),0.07)',
                                borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.85rem',
                                color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', alignItems: 'center'
                            }}>
                                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                                El periodo se calcula matemáticamente según la modalidad de <strong>{contract?.periodType === '30_dias' ? '30 Días Calendario' : 'Mes Cumplido'}</strong> configurada en tu contrato base.
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                                Se encontraron <strong>{activities.length}</strong> obligaciones en tu contrato. En el siguiente paso deberás reportar el avance de cada una.
                            </p>
                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={next}>
                                Continuar <ChevronRight size={18} />
                            </button>
                        </motion.div>
                    )}

                    {/* ── STEP 2: Actividades ─────────────────────────────── */}
                    {step === 2 && (
                        <motion.div key="step2" variants={stepVariants} initial="enter" animate="center" exit="exit">
                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileText size={22} color="var(--primary)" /> Informe de Actividades
                            </h2>
                            {activities.length === 0 && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <AlertCircle size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                    <p>No hay obligaciones configuradas en tu contrato.<br />Ve a Configuración de Contrato y sube tu minuta.</p>
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {activities.map((act, idx) => (
                                    <div key={idx} style={{
                                        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden'
                                    }}>
                                        {/* Activity header */}
                                        <div style={{
                                            padding: '0.75rem 1rem',
                                            background: 'var(--surface)',
                                            borderBottom: '1px solid var(--border)',
                                            display: 'flex', alignItems: 'center', gap: '0.75rem'
                                        }}>
                                            <div style={{
                                                padding: '0.2rem 0.6rem', background: 'var(--primary)',
                                                color: 'white', borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap'
                                            }}>
                                                {act.obligationCode}
                                            </div>
                                            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 }}>
                                                {act.obligationText}
                                            </p>
                                        </div>

                                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {/* Comment */}
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    <label className="label" style={{ margin: 0 }}>
                                                        Comentario de lo realizado <span style={{ color: 'var(--error)' }}>*</span>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="btn"
                                                        onClick={() => handleImproveComment(idx)}
                                                        disabled={improvingIdx === idx || !act.comment?.trim()}
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
                                                            cursor: improvingIdx === idx || !act.comment?.trim() ? 'not-allowed' : 'pointer',
                                                            opacity: !act.comment?.trim() ? 0.6 : 1
                                                        }}
                                                    >
                                                        <RefreshCw size={13} />
                                                        {improvingIdx === idx ? 'Redactando con IA...' : 'Mejorar con IA (30-50 palabras)'}
                                                    </button>
                                                </div>
                                                <textarea
                                                    className="input" rows={3}
                                                    placeholder="Describe brevemente la idea de la actividad realizada y presiona 'Mejorar con IA'..."
                                                    value={act.comment}
                                                    onChange={e => updateActivity(idx, 'comment', e.target.value)}
                                                />
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                                                    {(() => {
                                                        const count = act.comment ? act.comment.trim().split(/\s+/).filter(Boolean).length : 0;
                                                        const inRange = count >= 30 && count <= 50;
                                                        return (
                                                            <span style={{
                                                                fontSize: '0.72rem',
                                                                color: inRange ? 'var(--success)' : 'var(--text-muted)',
                                                                fontWeight: inRange ? 600 : 400
                                                            }}>
                                                                {count} palabras {inRange ? '(rango ideal)' : ''}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            {/* Evidence upload */}
                                            <div>
                                                <label className="label">Evidencias / Soportes</label>
                                                <DropZone id={`dz-${idx}`} onFiles={files => addFiles(idx, files)} />
                                                {act.files.length > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.6rem' }}>
                                                        {act.files.map((f, fi) => (
                                                            <FileChip key={fi} file={f} onRemove={() => removeFile(idx, fi)} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={prev}>
                                    <ChevronLeft size={18} /> Atrás
                                </button>
                                <button className="btn btn-primary" style={{ flex: 2 }} onClick={next} disabled={!step2Valid}>
                                    Continuar <ChevronRight size={18} />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* ── STEP 3: Seguridad Social ─────────────────────────── */}
                    {step === 3 && (
                        <motion.div key="step3" variants={stepVariants} initial="enter" animate="center" exit="exit">
                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Shield size={22} color="var(--primary)" /> Aportes a Seguridad Social
                            </h2>

                            {/* Zona de Carga Inteligente de Planilla */}
                            <div style={{ 
                                padding: '1.25rem', 
                                border: '1px dashed var(--primary)', 
                                borderRadius: 'var(--radius-md)', 
                                background: 'rgba(79, 70, 229, 0.03)',
                                marginBottom: '1.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.75rem',
                                textAlign: 'center'
                            }}>
                                <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
                                    Carga de Planilla Inteligente por IA
                                </p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, maxWidth: '480px' }}>
                                    Sube tu planilla de aportes de seguridad social (PDF) de este mes para que la IA extraiga el operador, planilla, periodo y valores pagados automáticamente.
                                </p>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <label className="btn" style={{ 
                                        fontSize: '0.8rem', 
                                        background: 'var(--primary)', 
                                        color: 'white', 
                                        cursor: 'pointer',
                                        padding: '0.5rem 1rem',
                                        borderRadius: 'var(--radius-md)',
                                        opacity: uploadingPlanilla ? 0.7 : 1
                                    }}>
                                        {uploadingPlanilla ? '⏳ Procesando Planilla...' : (planillaPath ? 'Cambiar Planilla (PDF)' : 'Subir Planilla del Mes (PDF)')}
                                        <input type="file" style={{ display: 'none' }} onChange={handlePlanillaUpload} accept=".pdf" disabled={uploadingPlanilla} />
                                    </label>
                                    {planillaPath && (!ss.planillaNumber || passwordModalOpen) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPasswordModalOpen(true);
                                                setPasswordError('');
                                                setDocPassword('');
                                            }}
                                            className="btn"
                                            style={{
                                                fontSize: '0.8rem',
                                                border: '1px solid #f59e0b',
                                                color: '#f59e0b',
                                                background: 'rgba(245, 158, 11, 0.1)',
                                                padding: '0.5rem 1rem',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <Lock size={14} /> Desbloquear con Clave
                                        </button>
                                    )}
                                </div>
                                {success && <p style={{ fontSize: '0.8rem', color: 'var(--success)', margin: 0 }}>{success}</p>}
                                {error && <p style={{ fontSize: '0.8rem', color: 'var(--error)', margin: 0 }}>{error}</p>}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div className="form-group">
                                    <label className="label">Operador <span style={{ color: 'var(--error)' }}>*</span></label>
                                    <input className="input" placeholder="Ej: SIMPLE, SOI, Mi Planilla"
                                        value={ss.operator} onChange={e => setSs(p => ({ ...p, operator: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Número de Planilla <span style={{ color: 'var(--error)' }}>*</span></label>
                                    <input className="input" placeholder="Ej: 2026-04-001234"
                                        value={ss.planillaNumber} onChange={e => setSs(p => ({ ...p, planillaNumber: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Período Cotizado</label>
                                    <input className="input" placeholder="Ej: Abril 2026"
                                        value={ss.period} onChange={e => setSs(p => ({ ...p, period: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Total Pagado ($) <span style={{ color: 'var(--error)' }}>*</span></label>
                                    <input className="input" type="number" placeholder="0"
                                        value={ss.totalPaid} onChange={e => setSs(p => ({ ...p, totalPaid: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Salud ($)</label>
                                    <input className="input" type="number" placeholder="0"
                                        value={ss.saludPaid} onChange={e => setSs(p => ({ ...p, saludPaid: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Pensión ($)</label>
                                    <input className="input" type="number" placeholder="0"
                                        value={ss.pensionPaid} onChange={e => setSs(p => ({ ...p, pensionPaid: e.target.value }))} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="label">ARL ($)</label>
                                    <input className="input" type="number" placeholder="0"
                                        value={ss.arlPaid} onChange={e => setSs(p => ({ ...p, arlPaid: e.target.value }))} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                <button className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={prev}>
                                    <ChevronLeft size={18} /> Atrás
                                </button>
                                <button className="btn btn-primary" style={{ flex: 2 }} onClick={next} disabled={!step3Valid}>
                                    Revisar <ChevronRight size={18} />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* ── STEP 4: Confirm & Generate ────────────────────────── */}
                    {step === 4 && !result && (
                        <motion.div key="step4" variants={stepVariants} initial="enter" animate="center" exit="exit">
                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Package size={22} color="var(--primary)" /> Confirmar y Generar Paquete
                            </h2>

                            {/* Summary */}
                            <div style={{
                                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                                overflow: 'hidden', marginBottom: '1.5rem'
                            }}>
                                <div style={{ padding: '0.75rem 1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.9rem' }}>
                                    Resumen del Periodo
                                </div>
                                <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Periodo:</span>
                                    <span>{periodData.periodFrom} al {periodData.periodTo}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>Obligaciones reportadas:</span>
                                    <span>{activities.filter(a => a.comment).length} / {activities.length}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>Evidencias totales:</span>
                                    <span>{activities.reduce((s, a) => s + a.files.length, 0)} archivos</span>
                                    <span style={{ color: 'var(--text-muted)' }}>Planilla SS:</span>
                                    <span>{ss.planillaNumber || '—'}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>Total SS pagado:</span>
                                    <span>$ {Number(ss.totalPaid || 0).toLocaleString('es-CO')}</span>
                                </div>
                            </div>

                            <div style={{
                                padding: '0.875rem 1rem', background: 'rgba(var(--primary-rgb,79,70,229),0.07)',
                                borderRadius: 'var(--radius-md)', marginBottom: '1.5rem',
                                fontSize: '0.825rem', color: 'var(--text-muted)'
                            }}>
                                <strong>Se generarán:</strong> Certificado del Supervisor · Informe de Actividades · Descuento de Estampillas · Retención en la Fuente + Anexos Descripción por obligación y evidencias organizadas en un ZIP listo para entregar.
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={prev}>
                                    <ChevronLeft size={18} /> Corregir
                                </button>
                                <button
                                    className="btn btn-primary"
                                    style={{ flex: 2, background: generating ? 'var(--text-muted)' : undefined }}
                                    onClick={handleGenerate}
                                    disabled={generating || saving}
                                >
                                    {generating ? '⏳ Generando...' : <><Package size={18} /> Generar Paquete</>}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* ── SUCCESS ───────────────────────────────────────────── */}
                    {result && (
                        <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            <div style={{ textAlign: 'center', padding: '1rem 0 2rem' }}>
                                <CheckCircle2 size={64} color="var(--success)" style={{ marginBottom: '1rem' }} />
                                <h2 style={{ marginBottom: '0.5rem' }}>¡Paquete Generado!</h2>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                                    Tus 4 formatos y evidencias están listos en un solo archivo ZIP.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 360, margin: '0 auto' }}>
                                    <button className="btn btn-primary" onClick={() => onComplete(result)}>
                                        <Download size={18} /> Descargar ZIP
                                    </button>
                                    <button className="btn" style={{ border: '1px solid var(--border)' }}
                                        onClick={() => { setResult(null); setStep(1); }}>
                                        Crear Nuevo Periodo
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {/* Modal para solicitar contraseña de la planilla de seguridad social */}
            {passwordModalOpen && (
                <div 
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(5px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        padding: '1rem'
                    }}
                >
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="glass"
                        style={{
                            width: '100%',
                            maxWidth: '460px',
                            padding: '2rem',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            background: '#181b26',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ 
                                    width: '42px', 
                                    height: '42px', 
                                    borderRadius: '50%', 
                                    background: 'rgba(245, 158, 11, 0.15)', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    border: '1px solid rgba(245, 158, 11, 0.3)'
                                }}>
                                    <Lock size={22} color="#f59e0b" />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                                        Planilla Protegida con Contraseña
                                    </h3>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                                        Desbloqueo para extracción con IA
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setPasswordModalOpen(false);
                                    setPasswordError('');
                                }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '4px'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                            Esta planilla de seguridad social tiene clave de seguridad. Intentamos abrirla automáticamente con tu número de cédula, pero no coincidió. Por favor escribe la contraseña del documento para que la IA pueda procesarlo:
                        </p>

                        <form onSubmit={handleUnlockPlanillaSubmit}>
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label className="label" style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                                    Contraseña de la Planilla
                                </label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input 
                                        type={showPassword ? 'text' : 'password'}
                                        className="input"
                                        placeholder="Ingresa la contraseña del PDF"
                                        value={docPassword}
                                        onChange={(e) => setDocPassword(e.target.value)}
                                        autoFocus
                                        style={{ paddingRight: '2.5rem', width: '100%' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {passwordError && (
                                    <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <AlertCircle size={14} /> {passwordError}
                                    </p>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPasswordModalOpen(false);
                                        setPasswordError('');
                                    }}
                                    className="btn"
                                    style={{ border: '1px solid var(--border)' }}
                                    disabled={unlockingDoc}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={unlockingDoc}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    {unlockingDoc ? '⏳ Desbloqueando...' : 'Desbloquear y Procesar'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

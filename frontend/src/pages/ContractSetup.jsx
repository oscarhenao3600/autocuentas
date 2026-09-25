import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { filterSpecificObligations, getContractDurationText } from '../utils/period.utils';
import { motion } from 'framer-motion';
import { FileUp, Save, CheckCircle, AlertCircle, Loader2, FileText, Info, ArrowLeft, Plus, Trash2, Lock, Eye, EyeOff, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ContractSetup = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [uploadingAdd, setUploadingAdd] = useState(false);
    const [uploadingAddRp, setUploadingAddRp] = useState(false);
    const [uploadingActa, setUploadingActa] = useState(false);
    const [uploadingRp, setUploadingRp] = useState(false);
    const [contract, setContract] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [extractingBank, setExtractingBank] = useState(false);
    const [extractingRut, setExtractingRut] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [passwordDocType, setPasswordDocType] = useState('bankCertificate'); // 'bankCertificate' or 'rut'
    const [docPassword, setDocPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [unlockingDoc, setUnlockingDoc] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        fetchContract();
    }, []);

    const fetchContract = async () => {
        try {
            const { data } = await api.get('/contracts');
            if (data && data.activities) {
                data.activities = filterSpecificObligations(data.activities);
            }
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

    const handleAdditionUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('additionFile', file);

        setUploadingAdd(true);
        setError('');
        setSuccess('');
        try {
            const { data } = await api.post('/contracts/upload-addition', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setContract(data.data);
            setSuccess('Modificatorio de adición procesado por IA con éxito. Por favor verifique los datos.');
        } catch (err) {
            setError('Error al procesar la adición: ' + (err.response?.data?.message || err.message));
        } finally {
            setUploadingAdd(false);
        }
    };

    const handleAdditionRpUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('additionRpFile', file);

        setUploadingAddRp(true);
        setError('');
        setSuccess('');
        try {
            const { data } = await api.post('/contracts/upload-addition-rp', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setContract(data.data);
            setSuccess('Registro Presupuestal (RP) de adición procesado por IA con éxito.');
        } catch (err) {
            setError('Error al procesar el RP de la adición: ' + (err.response?.data?.message || err.message));
        } finally {
            setUploadingAddRp(false);
        }
    };

    const handleActaUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('actaInicioFile', file);

        setUploadingActa(true);
        setError('');
        setSuccess('');
        try {
            const { data } = await api.post('/contracts/upload-acta-inicio', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setContract(data.data);
            const startStr = data.data.startDate ? data.data.startDate.split('T')[0] : 'N/A';
            const endStr = data.data.endDate ? ` | Fin: ${data.data.endDate.split('T')[0]}` : '';
            const durationStr = ` | Plazo: ${getContractDurationText(data.data)}`;
            setSuccess(`Acta de Inicio procesada con éxito por la IA. Inicio: ${startStr}${endStr}${durationStr}`);
        } catch (err) {
            setError('Error al procesar el Acta de Inicio: ' + (err.response?.data?.message || err.message));
        } finally {
            setUploadingActa(false);
        }
    };

    const handleRpUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('rpFile', file);

        setUploadingRp(true);
        setError('');
        setSuccess('');
        try {
            const { data } = await api.post('/contracts/upload-rp', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setContract(data.data);
            setSuccess('Registro Presupuestal (RP) procesado con éxito por la IA.');
        } catch (err) {
            setError('Error al procesar el RP: ' + (err.response?.data?.message || err.message));
        } finally {
            setUploadingRp(false);
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

        if (type === 'bankCertificate') {
            setExtractingBank(true);
        } else if (type === 'rut') {
            setExtractingRut(true);
        }
        setError('');
        setSuccess('');

        try {
            const { data } = await api.post('/contracts/upload-attachments', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (data.data) {
                setContract(data.data);
            }

            if (data.requiresPassword) {
                setPasswordDocType(data.docType || type);
                setPasswordModalOpen(true);
                setDocPassword('');
                setPasswordError(data.message || 'El documento está protegido con contraseña.');
                return;
            }

            if (type === 'bankCertificate') {
                setSuccess(data.message || 'Certificación Bancaria subida y procesada por IA con éxito. Banco, Cuenta y Tipo de Cuenta autocompletados.');
            } else if (type === 'rut') {
                setSuccess(data.message || 'RUT subido y procesado por IA con éxito. Datos fiscales y dirección autocompletados.');
            } else {
                setSuccess('Anexo subido correctamente.');
            }
            setTimeout(() => setSuccess(''), 6000);
        } catch (err) {
            setError('Error al subir anexo: ' + (err.response?.data?.message || err.message));
        } finally {
            if (type === 'bankCertificate') {
                setExtractingBank(false);
            } else if (type === 'rut') {
                setExtractingRut(false);
            }
        }
    };

    const handleUnlockDocSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!docPassword.trim()) {
            setPasswordError('Por favor ingresa la contraseña del documento.');
            return;
        }

        setUnlockingDoc(true);
        setPasswordError('');

        const endpoint = passwordDocType === 'rut'
            ? '/contracts/unlock-rut'
            : '/contracts/unlock-bank-certificate';

        try {
            const { data } = await api.post(endpoint, {
                password: docPassword.trim()
            });

            if (data.data) {
                setContract(data.data);
            }
            setPasswordModalOpen(false);
            setDocPassword('');
            setSuccess(data.message || '¡Documento desbloqueado y procesado por IA con éxito!');
            setTimeout(() => setSuccess(''), 6000);
        } catch (err) {
            setPasswordError(err.response?.data?.message || 'Error al desbloquear el documento. Verifica la contraseña.');
        } finally {
            setUnlockingDoc(false);
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
                                    <label className="label">Clase o Tipo de Contrato</label>
                                    <input className="input" value={contract.contractType || ''} onChange={(e) => setContract({...contract, contractType: e.target.value})} placeholder="Ej: Prestación de Servicios" />
                                </div>
                                <div className="form-group">
                                    <label className="label">Número de Contrato</label>
                                    <input className="input" value={contract.contractNumber || ''} onChange={(e) => setContract({...contract, contractNumber: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Fecha Inicio Contrato</label>
                                    <input className="input" type="date" value={contract.startDate ? contract.startDate.split('T')[0] : ''} onChange={(e) => setContract({...contract, startDate: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Fecha Fin Contrato</label>
                                    <input className="input" type="date" value={contract.endDate ? contract.endDate.split('T')[0] : ''} onChange={(e) => setContract({...contract, endDate: e.target.value})} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ padding: '0.6rem 0.9rem', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.85rem' }}>
                                        <span><strong>⏱️ Plazo / Duración calculada:</strong> {getContractDurationText(contract)}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Modalidad: {contract.periodType === '30_dias' ? 'Por días calendario (30 días)' : 'Mes cumplido'}</span>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="label">Valor Mensual ($)</label>
                                    <input className="input" type="number" value={contract.monthlyValue || ''} onChange={(e) => setContract({...contract, monthlyValue: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Valor Mensual en Letras</label>
                                    <input className="input" value={contract.monthlyValueWord || ''} onChange={(e) => setContract({...contract, monthlyValueWord: e.target.value})} placeholder="Ej: CUATRO MILLONES DE PESOS M/CTE" />
                                </div>
                                <div className="form-group">
                                    <label className="label">Valor Total del Contrato ($)</label>
                                    <input className="input" type="number" value={contract.totalValue || ''} onChange={(e) => setContract({...contract, totalValue: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Valor Total en Letras</label>
                                    <input className="input" value={contract.totalValueWord || ''} onChange={(e) => setContract({...contract, totalValueWord: e.target.value})} placeholder="Ej: DIECIOCHO MILLONES DE PESOS M/CTE" />
                                </div>
                                <div className="form-group">
                                    <label className="label">CDP del Contrato</label>
                                    <input className="input" value={contract.cdp || ''} onChange={(e) => setContract({...contract, cdp: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="label">RP del Contrato</label>
                                    <input className="input" value={contract.rp || ''} onChange={(e) => setContract({...contract, rp: e.target.value})} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="label">Rubro Presupuestal</label>
                                    <input className="input" value={contract.rubro || ''} onChange={(e) => setContract({...contract, rubro: e.target.value})} />
                                </div>
                                
                                <div className="form-group">
                                    <label className="label">Entidad Bancaria</label>
                                    <input className="input" value={contract.bankName || ''} onChange={(e) => setContract({...contract, bankName: e.target.value})} placeholder="Ej: BANCOLOMBIA" />
                                </div>
                                <div className="form-group">
                                    <label className="label">Número de Cuenta</label>
                                    <input className="input" value={contract.accountNumber || ''} onChange={(e) => setContract({...contract, accountNumber: e.target.value})} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Tipo de Cuenta (Método Pago)</label>
                                    <input className="input" value={contract.paymentMethod || ''} onChange={(e) => setContract({...contract, paymentMethod: e.target.value})} placeholder="Ej: Ahorros / Corriente" />
                                </div>
                                <div className="form-group">
                                    <label className="label">Dirección del Contratista</label>
                                    <input className="input" value={contract.contractorAddress || ''} onChange={(e) => setContract({...contract, contractorAddress: e.target.value})} placeholder="Ej: Carrera 18 # 2-75" />
                                </div>
                                <div className="form-group">
                                    <label className="label">Teléfono del Contratista</label>
                                    <input className="input" value={contract.contractorPhone || ''} onChange={(e) => setContract({...contract, contractorPhone: e.target.value})} placeholder="Ej: 3113414361" />
                                </div>
                                <div className="form-group">
                                    <label className="label">Ciudad Expedición Cédula</label>
                                    <input className="input" value={contract.idCity || ''} onChange={(e) => setContract({...contract, idCity: e.target.value})} placeholder="Ej: Armenia" />
                                </div>
                                <div className="form-group">
                                    <label className="label">Correo Electrónico para Cuentas</label>
                                    <input className="input" value={contract.contractorEmail || ''} onChange={(e) => setContract({...contract, contractorEmail: e.target.value})} placeholder="Ej: contratista@correo.com" />
                                </div>

                                <div className="form-group">
                                    <label className="label">Nombre del Supervisor</label>
                                    <input className="input" value={contract.supervisorName || ''} onChange={(e) => setContract({...contract, supervisorName: e.target.value})} />
                                </div>
                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label className="label">Dependencia / Cargo del Supervisor</label>
                                    <input className="input" value={contract.supervisorDependency || ''} onChange={(e) => setContract({...contract, supervisorDependency: e.target.value})} placeholder="Ej: Secretaría de Planeación" />
                                </div>
                            </div>
                            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-main)', fontWeight: '600' }}>
                                    Opciones Tributarias (Formato Retención en la Fuente)
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={contract.isTaxFiler || false} 
                                            onChange={(e) => setContract({...contract, isTaxFiler: e.target.checked})} 
                                        />
                                        <span>¿Es declarante de impuesto sobre la renta?</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={contract.takesCosts || false} 
                                            onChange={(e) => setContract({...contract, takesCosts: e.target.checked})} 
                                        />
                                        <span>¿Tomará costos y deducciones asociadas?</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={contract.takesExemptRent !== false} 
                                            onChange={(e) => setContract({...contract, takesExemptRent: e.target.checked})} 
                                        />
                                        <span>¿Tomará deducción del 25% como renta exenta?</span>
                                    </label>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: '1.25rem' }}>
                                <label className="label">Objeto del Contrato</label>
                                <textarea className="input" rows="3" value={contract.contractObject || ''} onChange={(e) => setContract({...contract, contractObject: e.target.value})} />
                            </div>
                            <div className="form-group" style={{ marginTop: '1.5rem' }}>
                                <label className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Obligaciones Específicas del Contratista (para evidencias e informe mensual)</span>
                                    <button 
                                        type="button" 
                                        className="btn btn-primary" 
                                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                        onClick={() => {
                                            const newAct = prompt('Ingresa la nueva obligación específica:');
                                            if (newAct && newAct.trim()) {
                                                setContract({
                                                    ...contract,
                                                    activities: [...(contract.activities || []), newAct.trim()]
                                                });
                                            }
                                        }}
                                    >
                                        <Plus size={12} /> Agregar Actividad
                                    </button>
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    {(!contract.activities || contract.activities.length === 0) ? (
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>No hay obligaciones específicas registradas. Haz clic en "Agregar Actividad" para añadir una o vuelve a subir tu minuta.</p>
                                    ) : (
                                        contract.activities.map((act, index) => (
                                            <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <input 
                                                    className="input" 
                                                    value={act} 
                                                    onChange={(e) => {
                                                        const updated = [...contract.activities];
                                                        updated[index] = e.target.value;
                                                        setContract({ ...contract, activities: updated });
                                                    }}
                                                    placeholder={`Obligación Específica ${index + 1}`}
                                                />
                                                <button 
                                                    type="button" 
                                                    className="btn" 
                                                    style={{ background: 'transparent', color: 'var(--error)', padding: '0.5rem', border: '1px solid var(--error)' }}
                                                    onClick={() => {
                                                        const updated = contract.activities.filter((_, i) => i !== index);
                                                        setContract({ ...contract, activities: updated });
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ─── Configuración de Periodos ─── */}
                        <div style={{ background: 'rgba(79, 70, 229, 0.05)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid var(--border)' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                                <Info size={18} />
                                Configuración de Periodos de Cobro
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                                <div className="form-group">
                                    <label className="label">Tipo de Periodo (Forma de Pago)</label>
                                    <select 
                                        className="input" 
                                        value={contract.periodType || 'mes_cumplido'} 
                                        onChange={(e) => setContract({...contract, periodType: e.target.value})}
                                    >
                                        <option value="mes_cumplido">Mes Cumplido (ej: 28 Agosto al 27 Septiembre)</option>
                                        <option value="30_dias">30 Días Calendario (ej: 28 Agosto al 26 Septiembre)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Plazo Inicial del Contrato (Meses)</label>
                                    <input 
                                        className="input" 
                                        type="number" 
                                        min="1"
                                        value={contract.initialDurationMonths || 4} 
                                        onChange={(e) => setContract({...contract, initialDurationMonths: parseInt(e.target.value) || 1})} 
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="label">Día de Corte Mensual (Por defecto: 25)</label>
                                    <input 
                                        className="input" 
                                        type="number" 
                                        min="1" 
                                        max="31"
                                        value={contract.cutoffDay || 25} 
                                        onChange={(e) => setContract({...contract, cutoffDay: parseInt(e.target.value) || 25})} 
                                    />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="label">Plazo de Ejecución (Texto literal de la Minuta / Días)</label>
                                    <input 
                                        className="input" 
                                        type="text"
                                        placeholder="Ej: CIENTO QUINCE (115) DIAS CALENDARIO CONTADOS A PARTIR DE LA CONFIGURACIÓN DEL INICIO EN LA PLATAFORMA SECOP II."
                                        value={contract.executionTerm || ''} 
                                        onChange={(e) => setContract({...contract, executionTerm: e.target.value})} 
                                    />
                                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                                        Este texto se insertará exactamente en el campo "Plazo de Ejecución" del Informe de Actividades.
                                    </small>
                                </div>
                            </div>
                        </div>

                        {/* ─── Adición Contractual (Modificatorios) ─── */}
                        <div style={{ background: 'rgba(234, 179, 8, 0.05)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem', border: '1px solid var(--accent)' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>
                                    <FileText size={18} />
                                    Adiciones y Prórrogas Contractuales
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={contract.hasAddition || false} 
                                            onChange={(e) => setContract({...contract, hasAddition: e.target.checked})}
                                        /> Activar Adición
                                    </label>
                                </div>
                            </h3>

                            {/* Upload modificatorio zone */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ padding: '1rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Sube el documento de la Adición (PDF)</p>
                                    <label className="btn" style={{ fontSize: '0.75rem', border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer' }}>
                                        {uploadingAdd ? 'Procesando...' : (contract.additionDocumentPath ? 'Reemplazar PDF' : 'Subir Modificatorio')}
                                        <input type="file" style={{ display: 'none' }} onChange={handleAdditionUpload} accept=".pdf" disabled={uploadingAdd} />
                                    </label>
                                </div>
                                <div style={{ padding: '1rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Sube el Registro Presupuestal RP de Adición (PDF)</p>
                                    <label className="btn" style={{ fontSize: '0.75rem', border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer' }}>
                                        {uploadingAddRp ? 'Procesando...' : (contract.additionRp ? 'Reemplazar RP PDF' : 'Subir RP Adición')}
                                        <input type="file" style={{ display: 'none' }} onChange={handleAdditionRpUpload} accept=".pdf" disabled={uploadingAddRp} />
                                    </label>
                                </div>
                            </div>

                            {contract.hasAddition && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
                                    <div className="form-group">
                                        <label className="label">Valor de la Adición ($)</label>
                                        <input className="input" type="number" value={contract.additionValue || ''} onChange={(e) => setContract({...contract, additionValue: e.target.value})} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Valor de la Adición en Letras</label>
                                        <input className="input" value={contract.additionValueWord || ''} onChange={(e) => setContract({...contract, additionValueWord: e.target.value})} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Plazo de la Adición (Meses/Días)</label>
                                        <input className="input" placeholder="Ej: DOS (02) MESES" value={contract.additionDuration || ''} onChange={(e) => setContract({...contract, additionDuration: e.target.value})} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Duración Adición (Meses numérico)</label>
                                        <input className="input" type="number" min="0" value={contract.additionDurationMonths || 0} onChange={(e) => setContract({...contract, additionDurationMonths: parseInt(e.target.value) || 0})} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Fecha Inicio Adición</label>
                                        <input className="input" type="date" value={contract.additionStartDate ? contract.additionStartDate.split('T')[0] : ''} onChange={(e) => setContract({...contract, additionStartDate: e.target.value})} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Fecha Fin Adición</label>
                                        <input className="input" type="date" value={contract.additionEndDate ? contract.additionEndDate.split('T')[0] : ''} onChange={(e) => setContract({...contract, additionEndDate: e.target.value})} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">CDP de la Adición</label>
                                        <input className="input" value={contract.additionCdp || ''} onChange={(e) => setContract({...contract, additionCdp: e.target.value})} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">RP de la Adición</label>
                                        <input className="input" value={contract.additionRp || ''} onChange={(e) => setContract({...contract, additionRp: e.target.value})} />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="label">Rubro Presupuestal de la Adición</label>
                                        <input className="input" value={contract.additionRubro || ''} onChange={(e) => setContract({...contract, additionRubro: e.target.value})} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileText size={18} color="var(--primary)" />
                                Documentos Contractuales y Anexos
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                {/* Acta de Inicio / SECOP II */}
                                <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                    <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Acta de Inicio / SECOP II</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                        {contract.startDate 
                                            ? `Inicio: ${contract.startDate.split('T')[0]}${contract.endDate ? ` | Fin: ${contract.endDate.split('T')[0]}` : ''} • ${getContractDurationText(contract)}` 
                                            : 'Define fecha de inicio y fin'}
                                    </p>
                                    <label className="btn" style={{ fontSize: '0.75rem', border: '1px solid var(--primary)', color: 'var(--primary)', cursor: 'pointer', display: 'inline-block', opacity: uploadingActa ? 0.7 : 1 }}>
                                        {uploadingActa ? '⏳ Procesando...' : contract.actaInicioPath ? <><CheckCircle size={14} style={{display:'inline', marginRight:'4px'}}/> Actualizar</> : 'Subir PDF'}
                                        <input type="file" style={{ display: 'none' }} onChange={handleActaUpload} accept=".pdf,.jpg,.jpeg,.png" disabled={uploadingActa} />
                                    </label>
                                </div>

                                {/* Registro Presupuestal RP */}
                                <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                    <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Registro Presupuestal (RP)</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                        {contract.rp ? `RP No. ${contract.rp}` : 'Extrae RP, CDP y Rubro'}
                                    </p>
                                    <label className="btn" style={{ fontSize: '0.75rem', border: '1px solid var(--primary)', color: 'var(--primary)', cursor: 'pointer', display: 'inline-block', opacity: uploadingRp ? 0.7 : 1 }}>
                                        {uploadingRp ? '⏳ Procesando...' : contract.rpPath ? <><CheckCircle size={14} style={{display:'inline', marginRight:'4px'}}/> Actualizar</> : 'Subir PDF'}
                                        <input type="file" style={{ display: 'none' }} onChange={handleRpUpload} accept=".pdf" disabled={uploadingRp} />
                                    </label>
                                </div>

                                {/* RUT Actualizado */}
                                <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>RUT Actualizado</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                        {contract.contractorAddress ? `${contract.contractorAddress} (${contract.idCity || ''})` : contract.rutPath ? 'Cargado en sistema' : 'Datos fiscales y DIAN'}
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                                        <label className="btn" style={{ fontSize: '0.75rem', border: '1px solid var(--primary)', color: 'var(--primary)', cursor: 'pointer', display: 'inline-block', opacity: extractingRut ? 0.7 : 1 }}>
                                            {extractingRut ? '⏳ Extrayendo...' : contract.rutPath ? <><CheckCircle size={14} style={{display:'inline', marginRight:'4px'}}/> Actualizar</> : 'Subir PDF'}
                                            <input type="file" style={{ display: 'none' }} onChange={(e) => handleAttachmentUpload(e, 'rut')} accept=".pdf,.jpg,.jpeg,.png" disabled={extractingRut} />
                                        </label>
                                        {contract.rutPath && (!contract.contractorAddress || contract.contractorAddress === 'N/A') && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPasswordDocType('rut');
                                                    setPasswordModalOpen(true);
                                                    setPasswordError('');
                                                    setDocPassword('');
                                                }}
                                                className="btn"
                                                style={{
                                                    fontSize: '0.7rem',
                                                    border: '1px solid #f59e0b',
                                                    color: '#f59e0b',
                                                    background: 'rgba(245, 158, 11, 0.1)',
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <Lock size={12} /> Desbloquear con Clave
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Certificado Bancario */}
                                <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Certificado Bancario</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                        {contract.bankName ? `${contract.bankName} (${contract.accountNumber || ''})` : 'Cuenta y banco'}
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                                        <label className="btn" style={{ fontSize: '0.75rem', border: '1px solid var(--primary)', color: 'var(--primary)', cursor: 'pointer', display: 'inline-block', opacity: extractingBank ? 0.7 : 1 }}>
                                            {extractingBank ? '⏳ Extrayendo...' : contract.bankCertificatePath ? <><CheckCircle size={14} style={{display:'inline', marginRight:'4px'}}/> Actualizar</> : 'Subir PDF'}
                                            <input type="file" style={{ display: 'none' }} onChange={(e) => handleAttachmentUpload(e, 'bankCertificate')} accept=".pdf,.jpg,.jpeg,.png" disabled={extractingBank} />
                                        </label>
                                        {contract.bankCertificatePath && (!contract.bankName || !contract.accountNumber) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPasswordDocType('bankCertificate');
                                                    setPasswordModalOpen(true);
                                                    setPasswordError('');
                                                    setDocPassword('');
                                                }}
                                                className="btn"
                                                style={{
                                                    fontSize: '0.7rem',
                                                    border: '1px solid #f59e0b',
                                                    color: '#f59e0b',
                                                    background: 'rgba(245, 158, 11, 0.1)',
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: 'var(--radius-sm)',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <Lock size={12} /> Desbloquear con Clave
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Seguridad Social */}
                                <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Seguridad Social</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                        {contract.securitySocialPath ? 'Cargado en sistema' : 'Planilla de aportes'}
                                    </p>
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

                {/* Modal para solicitar contraseña del certificado bancario */}
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
                                        <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>
                                            {passwordDocType === 'rut' ? 'RUT Protegido con Contraseña' : 'Certificado Protegido con Contraseña'}
                                        </h3>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
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
                                Este documento ({passwordDocType === 'rut' ? 'RUT' : 'PDF bancario'}) tiene clave de seguridad. Intentamos abrirlo automáticamente con tu número de cédula, pero no coincidió. Por favor escribe la contraseña del documento para que la IA pueda procesarlo:
                            </p>

                            <form onSubmit={handleUnlockDocSubmit}>
                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label className="label" style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>
                                        {passwordDocType === 'rut' ? 'Contraseña del RUT' : 'Contraseña del Certificado'}
                                    </label>
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input 
                                            type={showPassword ? 'text' : 'password'}
                                            className="input"
                                            placeholder={passwordDocType === 'rut' ? "Ingresa la contraseña del RUT" : "Ingresa la contraseña del PDF"}
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
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--text-muted)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {passwordError && (
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '0.5rem', 
                                        color: '#ef4444', 
                                        fontSize: '0.8rem', 
                                        marginBottom: '1rem',
                                        padding: '0.5rem 0.75rem',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid rgba(239, 68, 68, 0.2)'
                                    }}>
                                        <AlertCircle size={16} style={{ flexShrink: 0 }} />
                                        <span>{passwordError}</span>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPasswordModalOpen(false);
                                            setPasswordError('');
                                        }}
                                        className="btn"
                                        disabled={unlockingDoc}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid var(--border)',
                                            color: 'var(--text-muted)',
                                            padding: '0.5rem 1rem',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={unlockingDoc || !docPassword.trim()}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.5rem 1.25rem',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        {unlockingDoc ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                Desbloqueando y Procesando...
                                            </>
                                        ) : (
                                            <>
                                                <Lock size={16} />
                                                Desbloquear con IA
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default ContractSetup;

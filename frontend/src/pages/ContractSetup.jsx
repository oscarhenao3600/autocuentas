import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { filterSpecificObligations } from '../utils/period.utils';
import { motion } from 'framer-motion';
import { FileUp, Save, CheckCircle, AlertCircle, Loader2, FileText, Info, ArrowLeft, Plus, Trash2 } from 'lucide-react';
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
            setSuccess(`Acta de Inicio procesada con éxito por la IA. Fecha oficial de inicio: ${data.data.startDate || 'N/A'}`);
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
        }
        setError('');
        setSuccess('');

        try {
            const { data } = await api.post('/contracts/upload-attachments', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setContract(data.data);
            if (type === 'bankCertificate') {
                setSuccess('Certificación Bancaria subida y procesada por IA con éxito. Banco, Cuenta y Tipo de Cuenta autocompletados.');
            } else {
                setSuccess('Anexo subido correctamente.');
            }
            setTimeout(() => setSuccess(''), 5000);
        } catch (err) {
            setError('Error al subir anexo: ' + (err.response?.data?.message || err.message));
        } finally {
            if (type === 'bankCertificate') {
                setExtractingBank(false);
            }
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
                                        {contract.startDate ? `Inicio: ${contract.startDate.split('T')[0]}` : 'Define fecha de inicio'}
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
                                        {contract.rutPath ? 'Cargado en sistema' : 'Datos fiscales y DIAN'}
                                    </p>
                                    <label className="btn" style={{ fontSize: '0.75rem', border: '1px solid var(--primary)', color: 'var(--primary)', cursor: 'pointer', display: 'inline-block' }}>
                                        {contract.rutPath ? <><CheckCircle size={14} style={{display:'inline', marginRight:'4px'}}/> Actualizar</> : 'Subir PDF'}
                                        <input type="file" style={{ display: 'none' }} onChange={(e) => handleAttachmentUpload(e, 'rut')} accept=".pdf" />
                                    </label>
                                </div>

                                {/* Certificado Bancario */}
                                <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Certificado Bancario</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                        {contract.bankName ? `${contract.bankName} (${contract.accountNumber || ''})` : 'Cuenta y banco'}
                                    </p>
                                    <label className="btn" style={{ fontSize: '0.75rem', border: '1px solid var(--primary)', color: 'var(--primary)', cursor: 'pointer', display: 'inline-block', opacity: extractingBank ? 0.7 : 1 }}>
                                        {extractingBank ? '⏳ Extrayendo...' : contract.bankCertificatePath ? <><CheckCircle size={14} style={{display:'inline', marginRight:'4px'}}/> Actualizar</> : 'Subir PDF'}
                                        <input type="file" style={{ display: 'none' }} onChange={(e) => handleAttachmentUpload(e, 'bankCertificate')} accept=".pdf,.jpg,.jpeg,.png" disabled={extractingBank} />
                                    </label>
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
            </motion.div>
        </div>
    );
};

export default ContractSetup;

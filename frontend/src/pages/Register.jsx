import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Lock, User, Shield, Briefcase } from 'lucide-react';

const Register = () => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        role: 'client'
    });
    const [error, setError] = useState('');
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const result = await register(formData);
        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="flex-center" style={{ minHeight: '100vh', padding: '1rem', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}>
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="glass" 
                style={{ width: '100%', maxWidth: '450px', padding: '2.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}
            >
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '1.5rem', color: 'var(--text-main)' }}>Crear Cuenta</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Únete al sistema de gestión de cuentas</p>
                </div>

                {error && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ background: '#fef2f2', color: 'var(--error)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.875rem', textAlign: 'center', border: '1px solid #fee2e2' }}
                    >
                        {error}
                    </motion.div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="label">Nombre Completo</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input 
                                name="fullName"
                                type="text" 
                                className="input" 
                                placeholder="Juan Pérez"
                                style={{ paddingLeft: '2.5rem' }}
                                value={formData.fullName}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="label">Correo Electrónico</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input 
                                name="email"
                                type="email" 
                                className="input" 
                                placeholder="ejemplo@correo.com"
                                style={{ paddingLeft: '2.5rem' }}
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="label">Contraseña</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input 
                                name="password"
                                type="password" 
                                className="input" 
                                placeholder="Min. 8 caracteres"
                                style={{ paddingLeft: '2.5rem' }}
                                value={formData.password}
                                onChange={handleChange}
                                required
                                minLength={8}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="label">Tipo de Usuario</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div 
                                onClick={() => setFormData({ ...formData, role: 'client' })}
                                style={{ 
                                    padding: '0.75rem', 
                                    border: '1px solid', 
                                    borderColor: formData.role === 'client' ? 'var(--primary)' : 'var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: formData.role === 'client' ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Briefcase size={16} color={formData.role === 'client' ? 'var(--primary)' : 'var(--text-muted)'} />
                                <span style={{ fontSize: '0.875rem', color: formData.role === 'client' ? 'var(--primary)' : 'var(--text-main)' }}>Cliente</span>
                            </div>
                            <div 
                                onClick={() => setFormData({ ...formData, role: 'admin' })}
                                style={{ 
                                    padding: '0.75rem', 
                                    border: '1px solid', 
                                    borderColor: formData.role === 'admin' ? 'var(--primary)' : 'var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    background: formData.role === 'admin' ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Shield size={16} color={formData.role === 'admin' ? 'var(--primary)' : 'var(--text-muted)'} />
                                <span style={{ fontSize: '0.875rem', color: formData.role === 'admin' ? 'var(--primary)' : 'var(--text-main)' }}>Administrador</span>
                            </div>
                        </div>
                        {formData.role === 'admin' && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.5rem' }}>* Sujeto a disponibilidad (Máx. 5 administradores)</p>
                        )}
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', gap: '0.5rem' }}>
                        <UserPlus size={18} />
                        Crear Cuenta
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    ¿Ya tienes cuenta? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>Inicia sesión</Link>
                </p>
            </motion.div>
        </div>
    );
};

export default Register;

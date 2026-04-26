import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, ShieldCheck } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const result = await login(email, password);
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
                style={{ width: '100%', maxWidth: '400px', padding: '2.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}
            >
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div className="flex-center" style={{ width: '60px', height: '60px', background: 'var(--primary)', color: 'white', borderRadius: '50%', margin: '0 auto 1rem' }}>
                        <ShieldCheck size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', color: 'var(--text-main)' }}>Bienvenido</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Gestión de Cuentas - Alcaldía de Armenia</p>
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
                        <label className="label">Correo Electrónico</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input 
                                type="email" 
                                className="input" 
                                placeholder="ejemplo@correo.com"
                                style={{ paddingLeft: '2.5rem' }}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="label">Contraseña</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input 
                                type="password" 
                                className="input" 
                                placeholder="••••••••"
                                style={{ paddingLeft: '2.5rem' }}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', gap: '0.5rem' }}>
                        <LogIn size={18} />
                        Ingresar
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    ¿No tienes cuenta? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>Regístrate aquí</Link>
                </p>
            </motion.div>
        </div>
    );
};

export default Login;

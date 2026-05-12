import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ContractSetup from './pages/ContractSetup';
import MyDocuments from './pages/MyDocuments';
import PendingAccounts from './pages/PendingAccounts';
import ConfigureFormats from './pages/ConfigureFormats';

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/login" />;
    return children;
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route 
                        path="/contract-setup" 
                        element={
                            <ProtectedRoute>
                                <ContractSetup />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/dashboard" 
                        element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/my-documents" 
                        element={
                            <ProtectedRoute>
                                <MyDocuments />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/admin/accounts" 
                        element={
                            <ProtectedRoute>
                                <PendingAccounts />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/admin/formats" 
                        element={
                            <ProtectedRoute>
                                <ConfigureFormats />
                            </ProtectedRoute>
                        } 
                    />
                    <Route path="/" element={<Navigate to="/dashboard" />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Gem, ShieldCheck, KeyRound, AlertCircle, ArrowRight, HardDrive } from 'lucide-react';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, health } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ username, password });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      {/* Background glow effects */}
      <div className="login-bg-glow" />

      <div className="login-card">
        {/* Brand Header */}
        <div className="login-header">
          <div className="login-logo-box">
            <Gem size={32} className="login-logo-icon" />
          </div>
          <h1 className="login-title font-serif">JEWEL SUITE</h1>
          <p className="login-subtitle">Offline-First Jewellery Shop ERP & POS</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="login-error-alert">
            <AlertCircle size={18} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isSubmitting}
          >
            <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Terminal'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Dev helper badge */}
        <div className="demo-credentials-box">
          <div className="demo-title">
            <KeyRound size={13} />
            <span>Default Master Admin</span>
          </div>
          <div className="demo-creds font-mono">
            <span>Username: <strong>admin</strong></span>
            <span>Password: <strong>admin123</strong></span>
          </div>
        </div>

        {/* Offline & Architecture Notice */}
        <div className="login-footer">
          <div className="footer-status-item">
            <ShieldCheck size={14} className="text-emerald" />
            <span>Standalone Local Terminal</span>
          </div>
          <div className="footer-status-item">
            <HardDrive size={14} className="text-gold" />
            <span>SQLite: {health?.database || 'WAL Active'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

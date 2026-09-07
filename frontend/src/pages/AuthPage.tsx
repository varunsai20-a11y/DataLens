import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
  onSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login', onSuccess }) => {
  const { login, register, error, clearError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const toggleMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setFormError(null);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    // Basic Client Validation
    if (!email.trim() || !email.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ email, password, name: name.trim() || undefined });
      }
      if (onSuccess) onSuccess();
    } catch {
      // Error handled in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = formError || error;

  return (
    <div className="auth-outer-container">
      <div className="auth-split-layout">
        {/* Left Side: Mission Control Visual Section */}
        <div className="auth-left-panel">
          <div className="auth-left-header">
            <div className="auth-brand-badge">DATA RELIABILITY ENGINE</div>
            <h1 className="auth-left-title">DataLens Mission Control</h1>
            <p className="auth-left-subtitle">
              Statistics determine what changed. AI explains what it means. Continuous data quality & drift observability platform.
            </p>
          </div>

          {/* Node Graph Visualization Card */}
          <div className="auth-visual-card">
            <div className="auth-visual-card-header">
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#34d399', letterSpacing: '0.05em' }}>
                ● LIVE DATA FLOW MONITOR
              </span>
              <span className="auth-pulse-pill">PIPELINE HEALTHY</span>
            </div>

            <div className="auth-diagram-area">
              <svg width="100%" height="160" viewBox="0 0 460 160" style={{ overflow: 'visible' }}>
                {/* Connecting paths */}
                <path d="M 60 80 L 170 80" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" />
                <path d="M 170 80 L 280 80" stroke="#6366f1" strokeWidth="2" strokeDasharray="4" />
                <path d="M 280 80 L 390 80" stroke="#10b981" strokeWidth="2" />

                {/* Node 1: Ingestion */}
                <g transform="translate(60, 80)">
                  <circle r="24" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" />
                  <text textAnchor="middle" dy="4" fill="#ffffff" fontSize="11" fontWeight="bold">CSV / PQ</text>
                  <text textAnchor="middle" dy="38" fill="#9ca3af" fontSize="10">Ingestion</text>
                </g>

                {/* Node 2: BullMQ Queue */}
                <g transform="translate(170, 80)">
                  <circle r="24" fill="#1e293b" stroke="#6366f1" strokeWidth="2" />
                  <text textAnchor="middle" dy="4" fill="#ffffff" fontSize="11" fontWeight="bold">Worker</text>
                  <text textAnchor="middle" dy="38" fill="#9ca3af" fontSize="10">Profiling</text>
                </g>

                {/* Node 3: Python Engine */}
                <g transform="translate(280, 80)">
                  <circle r="24" fill="#1e293b" stroke="#8b5cf6" strokeWidth="2" />
                  <text textAnchor="middle" dy="4" fill="#ffffff" fontSize="11" fontWeight="bold">Engine</text>
                  <text textAnchor="middle" dy="38" fill="#9ca3af" fontSize="10">Drift Calc</text>
                </g>

                {/* Node 4: Quality Result */}
                <g transform="translate(390, 80)">
                  <circle r="28" fill="#065f46" stroke="#10b981" strokeWidth="3" />
                  <text textAnchor="middle" dy="-2" fill="#ffffff" fontSize="14" fontWeight="800">93.2</text>
                  <text textAnchor="middle" dy="12" fill="#34d399" fontSize="9" fontWeight="700">SCORE</text>
                  <text textAnchor="middle" dy="42" fill="#34d399" fontSize="10" fontWeight="bold">HEALTHY</text>
                </g>
              </svg>
            </div>

            {/* Live Features List */}
            <div className="auth-features-grid">
              <div className="auth-feature-item">
                <span className="auth-feature-icon">⚡</span>
                <div>
                  <div className="auth-feature-title">Schema Drift Detection</div>
                  <div className="auth-feature-desc">Automatic column addition, removal, and type mutation alerts</div>
                </div>
              </div>
              <div className="auth-feature-item">
                <span className="auth-feature-icon">📊</span>
                <div>
                  <div className="auth-feature-title">Distribution Drift Engine</div>
                  <div className="auth-feature-desc">KS-Test & PSI statistical testing for numeric & categorical features</div>
                </div>
              </div>
              <div className="auth-feature-item">
                <span className="auth-feature-icon">🤖</span>
                <div>
                  <div className="auth-feature-title">DataLens Intelligence</div>
                  <div className="auth-feature-desc">LLM root-cause summaries with deterministic fallback guarantees</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Authentication Panel */}
        <div className="auth-right-panel">
          <div className="auth-card">
            <div className="auth-card-header">
              <div className="auth-brand-logo-icon">DL</div>
              <h2 className="auth-card-title">
                {mode === 'login' ? 'Sign In to DataLens' : 'Create DataLens Account'}
              </h2>
              <p className="auth-card-sub">Access your data quality command center</p>
            </div>

            {/* Tab Switcher */}
            <div className="auth-tab-container">
              <button
                type="button"
                className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
                onClick={() => toggleMode('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
                onClick={() => toggleMode('register')}
              >
                Register
              </button>
            </div>

            {displayError && (
              <div className="auth-error-alert">
                <span style={{ marginRight: '6px' }}>⚠️</span>
                {displayError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              {mode === 'register' && (
                <div className="auth-form-group">
                  <label className="auth-form-label">FULL NAME</label>
                  <input
                    type="text"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="auth-input-field"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              <div className="auth-form-group">
                <label className="auth-form-label">EMAIL ADDRESS</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input-field"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="auth-form-group">
                <label className="auth-form-label">PASSWORD</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input-field"
                  required
                  disabled={isSubmitting}
                />
              </div>

              {mode === 'register' && (
                <div className="auth-form-group">
                  <label className="auth-form-label">CONFIRM PASSWORD</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="auth-input-field"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              )}

              <button type="submit" className="auth-submit-btn" disabled={isSubmitting}>
                {isSubmitting
                  ? mode === 'login'
                    ? 'Authenticating...'
                    : 'Creating Account...'
                  : mode === 'login'
                  ? 'Access Mission Control →'
                  : 'Create Account & Continue →'}
              </button>
            </form>

            <div className="auth-footer">
              {mode === 'login' ? (
                <p className="auth-footer-text">
                  Don&apos;t have an account?{' '}
                  <button type="button" className="auth-link-btn" onClick={() => toggleMode('register')}>
                    Register new account
                  </button>
                </p>
              ) : (
                <p className="auth-footer-text">
                  Already registered?{' '}
                  <button type="button" className="auth-link-btn" onClick={() => toggleMode('login')}>
                    Sign in to existing account
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


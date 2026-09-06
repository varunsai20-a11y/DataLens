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
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>🛡️</div>
          <h1 style={styles.title}>DataLens</h1>
          <p style={styles.subtitle}>Data Reliability & Quality Management Platform</p>
        </div>

        <div style={styles.tabContainer}>
          <button
            type="button"
            style={{ ...styles.tab, ...(mode === 'login' ? styles.activeTab : {}) }}
            onClick={() => toggleMode('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            style={{ ...styles.tab, ...(mode === 'register' ? styles.activeTab : {}) }}
            onClick={() => toggleMode('register')}
          >
            Create Account
          </button>
        </div>

        {displayError && (
          <div style={styles.errorAlert}>
            <span style={{ marginRight: '6px' }}>⚠️</span>
            {displayError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'register' && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Full Name</label>
              <input
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={styles.input}
                disabled={isSubmitting}
              />
            </div>
          )}

          <div style={styles.formGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
              disabled={isSubmitting}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
              disabled={isSubmitting}
            />
          </div>

          {mode === 'register' && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Confirm Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={styles.input}
                required
                disabled={isSubmitting}
              />
            </div>
          )}

          <button type="submit" style={styles.submitBtn} disabled={isSubmitting}>
            {isSubmitting
              ? mode === 'login'
                ? 'Signing In...'
                : 'Creating Account...'
              : mode === 'login'
              ? 'Sign In to DataLens'
              : 'Create Account'}
          </button>
        </form>

        <div style={styles.footer}>
          {mode === 'login' ? (
            <p style={styles.footerText}>
              Don't have an account?{' '}
              <button type="button" style={styles.linkBtn} onClick={() => toggleMode('register')}>
                Register here
              </button>
            </p>
          ) : (
            <p style={styles.footerText}>
              Already have an account?{' '}
              <button type="button" style={styles.linkBtn} onClick={() => toggleMode('login')}>
                Sign in here
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: '2rem 1rem',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    width: '100%',
    maxWidth: '440px',
    padding: '2.5rem 2rem',
    border: '1px solid #e2e8f0',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.75rem',
  },
  logo: {
    fontSize: '2.5rem',
    marginBottom: '0.25rem',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#0f172a',
    letterSpacing: '-0.025em',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#64748b',
    marginTop: '0.25rem',
  },
  tabContainer: {
    display: 'flex',
    borderBottom: '2px solid #e2e8f0',
    marginBottom: '1.5rem',
  },
  tab: {
    flex: 1,
    padding: '0.75rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#64748b',
    cursor: 'pointer',
    marginBottom: '-2px',
    transition: 'all 0.2s ease',
  },
  activeTab: {
    color: '#2563eb',
    borderBottomColor: '#2563eb',
  },
  errorAlert: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    marginBottom: '1.25rem',
    display: 'flex',
    alignItems: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#334155',
  },
  input: {
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    padding: '0.875rem',
    borderRadius: '8px',
    border: 'none',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '0.5rem',
    transition: 'background-color 0.2s ease',
  },
  footer: {
    marginTop: '1.5rem',
    textAlign: 'center',
    fontSize: '0.875rem',
  },
  footerText: {
    color: '#64748b',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
};

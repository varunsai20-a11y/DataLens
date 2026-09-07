import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [readyStatus, setReadyStatus] = useState<'checking' | 'ready' | 'error'>('checking');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await api.getReady();
        if (res.status === 'READY') {
          setReadyStatus('ready');
        } else {
          setReadyStatus('error');
        }
      } catch {
        setReadyStatus('error');
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand" onClick={() => onNavigate('datasets')}>
          <div className="brand-logo-icon">DL</div>
          <div className="brand-text">
            <span className="brand-title">DataLens</span>
            <span className="brand-badge">Mission Control</span>
          </div>
        </div>

        <nav className="navbar-nav">
          <button
            className={`nav-link ${currentView === 'datasets' ? 'active' : ''}`}
            onClick={() => onNavigate('datasets')}
          >
            <span>📊</span> Datasets Control
          </button>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div className="navbar-status">
            <span
              className={`status-pill ${
                readyStatus === 'ready'
                  ? 'status-ready'
                  : readyStatus === 'checking'
                  ? 'status-checking'
                  : 'status-error'
              }`}
            >
              <span className="status-dot"></span>
              {readyStatus === 'ready'
                ? 'SYSTEM OPERATIONAL'
                : readyStatus === 'checking'
                ? 'CHECKING PROBES...'
                : 'ENGINE OFFLINE'}
            </span>
          </div>

          {isAuthenticated && user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  padding: '0.35rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  color: '#ffffff',
                }}
              >
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>👤</span>
                <span>{user.name || user.email}</span>
                {user.role && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      backgroundColor: 'var(--primary-light)',
                      color: '#60a5fa',
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-sm)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {user.role}
                  </span>
                )}
              </div>
              <button
                onClick={logout}
                className="btn btn-sm btn-outline"
                style={{ fontSize: '0.78rem' }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

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
          <div className="brand-logo">🛡️</div>
          <div className="brand-text">
            <span className="brand-title">DataLens</span>
            <span className="brand-badge">Data Reliability</span>
          </div>
        </div>

        <nav className="navbar-nav">
          <button
            className={`nav-link ${currentView === 'datasets' ? 'active' : ''}`}
            onClick={() => onNavigate('datasets')}
          >
            Datasets
          </button>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                ? 'Backend: Online'
                : readyStatus === 'checking'
                ? 'Checking...'
                : 'Backend: Offline'}
            </span>
          </div>

          {isAuthenticated && user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: '#f1f5f9',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                <span>👤</span>
                <span>{user.name || user.email}</span>
              </div>
              <button
                onClick={logout}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #cbd5e1',
                  color: '#64748b',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
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

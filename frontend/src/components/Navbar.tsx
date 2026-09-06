import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
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
      </div>
    </header>
  );
};

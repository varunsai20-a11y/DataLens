import React, { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuthPage } from '../pages/AuthPage';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}>🛡️</div>
        <p style={styles.loadingText}>Verifying authentication session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage initialMode="login" />;
  }

  return <>{children}</>;
};

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  spinner: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  loadingText: {
    fontSize: '1rem',
    fontWeight: 500,
    color: '#64748b',
  },
};

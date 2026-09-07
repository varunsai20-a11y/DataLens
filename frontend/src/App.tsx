import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { DatasetsPage } from './pages/DatasetsPage';
import { AnalysisReportPage } from './pages/AnalysisReportPage';
import { AuthPage } from './pages/AuthPage';

import { ErrorBoundary } from './components/ErrorBoundary';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();

  return (
    <div className="app-container">
      <Navbar currentView="datasets" onNavigate={() => navigate('/')} />
      <main className="main-content">{children}</main>
    </div>
  );
};

const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage initialMode="login" />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage initialMode="register" />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout>
              <DatasetsPage
                onViewReport={(jobId, versionId) => {
                  if (jobId) {
                    navigate(`/report?jobId=${jobId}`);
                  } else if (versionId) {
                    navigate(`/report?versionId=${versionId}`);
                  }
                }}
              />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/report"
        element={
          <ProtectedRoute>
            <MainLayout>
              <AnalysisReportPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/report/:jobId"
        element={
          <ProtectedRoute>
            <MainLayout>
              <AnalysisReportPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

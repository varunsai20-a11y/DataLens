import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { DatasetsPage } from './pages/DatasetsPage';
import { AnalysisReportPage } from './pages/AnalysisReportPage';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentView = location.pathname.startsWith('/report') ? 'report' : 'datasets';

  return (
    <div className="app-container">
      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'datasets') navigate('/datasets');
          if (view === 'report') navigate('/report');
        }}
      />
      <main className="main-content">
        <Routes>
          <Route
            path="/datasets"
            element={
              <DatasetsPage
                onViewReport={(jobId, versionId) => {
                  if (jobId) navigate(`/report?jobId=${jobId}`);
                  else if (versionId) navigate(`/report?versionId=${versionId}`);
                }}
              />
            }
          />
          <Route path="/report" element={<AnalysisReportPage />} />
          <Route path="/report/:jobId" element={<AnalysisReportPage />} />
          <Route
            path="/"
            element={
              <DatasetsPage
                onViewReport={(jobId, versionId) => {
                  if (jobId) navigate(`/report?jobId=${jobId}`);
                  else if (versionId) navigate(`/report?versionId=${versionId}`);
                }}
              />
            }
          />
          <Route
            path="*"
            element={
              <div className="empty-box">
                <h3>404 Not Found</h3>
                <p>The page you are looking for does not exist.</p>
                <button className="btn btn-primary" onClick={() => navigate('/datasets')}>
                  Go to Datasets
                </button>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

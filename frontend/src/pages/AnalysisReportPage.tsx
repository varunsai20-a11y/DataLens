import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { AnalysisResult } from '../types';
import { QualityScoreCard } from '../components/QualityScoreCard';
import { KPISummary } from '../components/KPISummary';
import { ProfilingTable } from '../components/ProfilingTable';
import { AnomaliesList } from '../components/AnomaliesList';
import { RecommendationsPanel } from '../components/RecommendationsPanel';
import { AIInterpretationCard } from '../components/AIInterpretationCard';

export const AnalysisReportPage: React.FC = () => {
  const { jobId: routeJobId, versionId: routeVersionId } = useParams<{ jobId?: string; versionId?: string }>();
  const [searchParams] = useSearchParams();
  const jobId = routeJobId || searchParams.get('jobId') || undefined;
  const versionId = routeVersionId || searchParams.get('versionId') || undefined;
  const navigate = useNavigate();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        let data: AnalysisResult;
        if (jobId) {
          data = await api.getAnalysisResults(jobId);
        } else if (versionId) {
          data = await api.getVersionAnalysis(versionId);
        } else {
          throw new Error('No job or version ID provided');
        }
        setResult(data);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to load analysis report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [jobId, versionId]);

  if (loading) {
    return (
      <div style={{ padding: '2rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div className="job-spinner" style={{ width: '2rem', height: '2rem' }}></div>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: '#ffffff' }}>Loading Data Health Command Center...</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Fetching quality metrics, profiling statistics, and anomaly reports...</p>
          </div>
        </div>
        <div className="skeleton" style={{ height: '180px', marginBottom: '1.5rem' }}></div>
        <div className="skeleton" style={{ height: '220px', marginBottom: '1.5rem' }}></div>
        <div className="skeleton" style={{ height: '300px' }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--danger-border)' }}>
        <span style={{ fontSize: '2.5rem' }}>⚠️</span>
        <h3 style={{ fontSize: '1.4rem', color: 'var(--danger-text)', margin: '1rem 0 0.5rem 0' }}>Error Loading Analysis Report</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/datasets')}>
          ← Return to Dataset Control Center
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>No analysis results found for this target.</p>
        <button className="btn btn-primary" onClick={() => navigate('/datasets')}>
          ← Return to Datasets
        </button>
      </div>
    );
  }

  return (
    <div className="report-grid">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span className="badge badge-primary">COMMAND REPORT</span>
            <span className="dataset-id-tag">VERSION ID: {result.dataset_version_id.slice(0, 8)}...</span>
          </div>
          <h1 className="page-title">Data Health Command Center</h1>
          <p className="page-subtitle">
            Analyzed using DataLens Engine v{result.analysis_version || '1.0.0'} • Generated {new Date(result.created_at).toLocaleString()}
          </p>
        </div>
        <button className="btn btn-outline" onClick={() => navigate('/datasets')}>
          ← Back to Control Center
        </button>
      </div>

      {result.ai_summary && (
        <AIInterpretationCard interpretation={result.ai_summary} />
      )}

      <div className="score-card">
        <QualityScoreCard
          score={Number(result.overall_quality_score)}
          dimensions={result.dimensions}
          grade={result.overall_quality_score >= 90 ? 'A' :
                  result.overall_quality_score >= 80 ? 'B' :
                  result.overall_quality_score >= 70 ? 'C' :
                  result.overall_quality_score >= 60 ? 'D' : 'F'}
        />
      </div>

      <KPISummary summary={result.summary} />

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">1. Column Profiling & Cardinality Statistics</h3>
          <span className="badge badge-neutral">{result.profiling?.length || 0} Columns</span>
        </div>
        <div className="card-body">
          <ProfilingTable columns={result.profiling} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">2. Quality Issues & Anomaly Detection</h3>
          <span className="badge badge-warning">{(result.quality_checks?.length || 0) + (result.outliers?.length || 0)} Signals</span>
        </div>
        <div className="card-body">
          <AnomaliesList
            issues={result.quality_checks}
            outliers={result.outliers}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">3. Remediation Recommendations</h3>
          <span className="badge badge-success">{result.recommendations?.length || 0} Action Items</span>
        </div>
        <div className="card-body">
          <RecommendationsPanel recommendations={result.recommendations} />
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { AnalysisResult } from '../types';
import { QualityScoreCard } from '../components/QualityScoreCard';
import { KPISummary } from '../components/KPISummary';
import { ProfilingTable } from '../components/ProfilingTable';
import { AnomaliesList } from '../components/AnomaliesList';
import { RecommendationsPanel } from '../components/RecommendationsPanel';

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
      <div className="loading-state">
        <div className="job-spinner"></div>
        <p>Fetching analysis results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-box">
        <h3 className="text-danger">Error Loading Report</h3>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/datasets')}>
          Return to Datasets
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="empty-box">
        <p>No analysis results found for this target.</p>
        <button className="btn btn-primary" onClick={() => navigate('/datasets')}>
          Return to Datasets
        </button>
      </div>
    );
  }

  return (
    <div className="report-grid">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analysis Report</h1>
          <p className="page-subtitle">
            Dataset Version: <span className="font-mono">{result.dataset_version_id.slice(0, 8)}...</span>
          </p>
        </div>
        <button className="btn btn-outline" onClick={() => navigate('/datasets')}>
          ← Back to Datasets
        </button>
      </div>

      <div className="score-card">
        <QualityScoreCard
          score={result.overall_quality_score}
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
          <h3 className="card-title">Column Profiling</h3>
        </div>
        <div className="card-body">
          <ProfilingTable columns={result.profiling} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Quality Issues & Anomalies</h3>
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
          <h3 className="card-title">Remediation Recommendations</h3>
        </div>
        <div className="card-body">
          <RecommendationsPanel recommendations={result.recommendations} />
        </div>
      </div>
    </div>
  );
};

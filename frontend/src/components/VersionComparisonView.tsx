import React from 'react';
import { VersionComparison } from '../types';
import { AIInterpretationCard } from './AIInterpretationCard';

interface VersionComparisonViewProps {
  comparison: VersionComparison;
  onClose?: () => void;
}

export const VersionComparisonView: React.FC<VersionComparisonViewProps> = ({ comparison, onClose }) => {
  if (!comparison || !comparison.comparison_result) {
    return (
      <div className="alert alert-error" style={{ margin: '20px' }}>
        ⚠️ No valid version comparison payload available.
      </div>
    );
  }

  const metrics_summary = comparison.comparison_result.metrics_summary || ({} as any);
  const schema_drift = comparison.comparison_result.schema_drift || [];
  const distribution_drift = comparison.comparison_result.distribution_drift || [];
  const scoreDelta = Number(comparison.score_delta || 0);

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
      case 'SEVERE_DRIFT':
        return 'badge-danger';
      case 'HIGH':
      case 'MODERATE_DRIFT':
        return 'badge-warning';
      default:
        return 'badge-success';
    }
  };

  const intrinsicScore = Number(metrics_summary.intrinsic_quality_score ?? metrics_summary.target_quality_score ?? 0);
  const driftImpact = Number(metrics_summary.drift_impact_score ?? 100);
  const combinedHealth = Number(metrics_summary.combined_health_score ?? metrics_summary.target_quality_score ?? 0);
  const baseQuality = Number(metrics_summary.base_quality_score ?? 0);
  const targetQuality = Number(metrics_summary.target_quality_score ?? 0);
  const missingDelta = Number(metrics_summary.missing_percentage_delta ?? 0);
  const baseMissing = Number(metrics_summary.base_missing_percentage ?? 0);
  const targetMissing = Number(metrics_summary.target_missing_percentage ?? 0);

  return (
    <div className="version-comparison-view" style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff' }}>Version Drift Intelligence Report</h2>
            <span className="badge badge-primary">COMPARE METRICS</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
            Comparative structural, missingness & distribution evaluation across pipeline versions.
          </p>
        </div>
        {onClose && (
          <button className="btn btn-outline" onClick={onClose}>
            ✕ Close View
          </button>
        )}
      </div>

      {/* Visual Version Delta Timeline Banner */}
      <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.25rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
          <div style={{ padding: '0.5rem 0.85rem', borderRadius: '8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>BASE VERSION</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>V1</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: '120px', color: '#60a5fa', fontWeight: 700, fontSize: '0.8rem' }}>
            <span style={{ height: '2px', flex: 1, minWidth: '10px', background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.2), #3b82f6)' }}></span>
            <span style={{ whiteSpace: 'nowrap' }}>⚡ DRIFT EVALUATION →</span>
            <span style={{ height: '2px', flex: 1, minWidth: '10px', background: 'linear-gradient(90deg, #3b82f6, rgba(59, 130, 246, 0.2))' }}></span>
          </div>
          <div style={{ padding: '0.5rem 0.85rem', borderRadius: '8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--primary-border)', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: '0.68rem', color: '#60a5fa', fontWeight: 700 }}>TARGET VERSION</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>V2</div>
          </div>
        </div>
        <div>
          <span className={`badge ${scoreDelta >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.9rem', padding: '0.4rem 0.85rem' }}>
            SCORE DELTA: {scoreDelta >= 0 ? `+${scoreDelta.toFixed(1)}` : scoreDelta.toFixed(1)} PTS
          </span>
        </div>
      </div>

      {/* AI Interpretation Card */}
      <AIInterpretationCard
        datasetId={comparison.dataset_id}
        versionId={comparison.target_version_id}
        interpretation={comparison.ai_summary}
      />

      {/* Health & Drift Summary Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
        <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem', borderRadius: '12px', borderLeft: '4px solid #3b82f6', border: '1px solid var(--border-color)', borderLeftWidth: '4px' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.04em' }}>Intrinsic Quality</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', margin: '0.2rem 0' }}>
            {intrinsicScore.toFixed(1)} / 100
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Internal validity & completeness</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem', borderRadius: '12px', borderLeft: '4px solid #f59e0b', border: '1px solid var(--border-color)', borderLeftWidth: '4px' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.04em' }}>Drift Impact Score</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: driftImpact < 60 ? 'var(--danger-text)' : '#ffffff', margin: '0.2rem 0' }}>
            {driftImpact.toFixed(1)} / 100
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Regression vs previous version</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem', borderRadius: '12px', borderLeft: '4px solid #06b6d4', border: '1px solid var(--border-color)', borderLeftWidth: '4px' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.04em' }}>Combined Health</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: combinedHealth < 75 ? 'var(--warning-text)' : 'var(--success-text)', margin: '0.2rem 0' }}>
            {combinedHealth.toFixed(1)} / 100
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>60% Intrinsic + 40% Drift</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem', borderRadius: '12px', borderLeft: '4px solid #8b5cf6', border: '1px solid var(--border-color)', borderLeftWidth: '4px' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.04em' }}>Health Status</div>
          <div style={{ marginTop: '0.4rem' }}>
            <span className={`badge ${
              metrics_summary.health_status === 'HEALTHY' ? 'badge-success' :
              metrics_summary.health_status === 'STABLE' ? 'badge-primary' :
              metrics_summary.health_status === 'AT_RISK' ? 'badge-warning' : 'badge-danger'
            }`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
              {metrics_summary.health_status || 'HEALTHY'}
            </span>
          </div>
        </div>
      </div>

      {/* Warning banner if health status is AT_RISK, DEGRADED, or CRITICAL */}
      {metrics_summary.health_status && ['AT_RISK', 'DEGRADED', 'CRITICAL'].includes(metrics_summary.health_status) && (
        <div className="alert alert-error">
          ⚠️ Significant changes detected compared with previous version. Structural or statistical regression has lowered the Version Health Status to {metrics_summary.health_status}.
        </div>
      )}

      {/* KPI Delta Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800 }}>Quality Score Delta</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: scoreDelta >= 0 ? 'var(--success-text)' : 'var(--danger-text)', margin: '0.2rem 0' }}>
            {scoreDelta >= 0 ? `+${scoreDelta.toFixed(1)}` : scoreDelta.toFixed(1)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Base: {baseQuality.toFixed(1)} → Target: {targetQuality.toFixed(1)}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800 }}>Row Count Delta</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', margin: '0.2rem 0' }}>
            {metrics_summary.row_count_delta >= 0 ? `+${metrics_summary.row_count_delta}` : metrics_summary.row_count_delta}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Base: {metrics_summary.base_row_count} → Target: {metrics_summary.target_row_count}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800 }}>Column Count Delta</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', margin: '0.2rem 0' }}>
            {metrics_summary.column_count_delta >= 0 ? `+${metrics_summary.column_count_delta}` : metrics_summary.column_count_delta}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Base: {metrics_summary.base_column_count} → Target: {metrics_summary.target_column_count}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800 }}>Missingness Shift</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: missingDelta <= 0 ? 'var(--success-text)' : 'var(--danger-text)', margin: '0.2rem 0' }}>
            {missingDelta >= 0 ? `+${missingDelta.toFixed(1)}%` : `${missingDelta.toFixed(1)}%`}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Base: {baseMissing.toFixed(1)}% → Target: {targetMissing.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Schema Drift Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '1rem' }}>
          1. Structural Schema Drift ({schema_drift.length} Changes Detected)
        </h3>
        {schema_drift.length === 0 ? (
          <div style={{ backgroundColor: 'var(--success-light)', color: 'var(--success-text)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--success-border)', fontSize: '0.875rem' }}>
            ✓ No structural schema drift detected between base and target versions.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Change Type</th>
                  <th>Base Type</th>
                  <th>Target Type</th>
                  <th>Severity</th>
                  <th className="col-message">Diagnostic Message</th>
                </tr>
              </thead>
              <tbody>
                {schema_drift.map((drift: any, idx: number) => (
                  <tr key={idx}>
                    <td className="font-mono" style={{ fontWeight: 700, color: '#ffffff' }}>{drift.column}</td>
                    <td>
                      <span className={`badge ${drift.change_type === 'REMOVED' ? 'badge-danger' : drift.change_type === 'TYPE_CHANGED' ? 'badge-warning' : 'badge-primary'}`}>
                        {drift.change_type}
                      </span>
                    </td>
                    <td className="font-mono">{drift.base_type || '—'}</td>
                    <td className="font-mono">{drift.target_type || '—'}</td>
                    <td>
                      <span className={`badge ${getSeverityBadgeClass(drift.severity)}`}>
                        {drift.severity}
                      </span>
                    </td>
                    <td className="col-message">{drift.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Distribution Drift Section */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', marginBottom: '1rem' }}>
          2. Statistical Distribution Drift ({distribution_drift.length} Features Tested)
        </h3>
        {distribution_drift.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.875rem' }}>No common features available for distribution drift testing.</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Type</th>
                  <th>Test Method</th>
                  <th>Statistic / Score</th>
                  <th>p-value</th>
                  <th>Drift Severity</th>
                  <th className="col-text">Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {distribution_drift.map((drift: any, idx: number) => (
                  <tr key={idx}>
                    <td className="font-mono" style={{ fontWeight: 700, color: '#ffffff' }}>{drift.column}</td>
                    <td><span className="badge badge-neutral">{drift.feature_type}</span></td>
                    <td>{drift.method}</td>
                    <td className="font-mono">{drift.statistic}</td>
                    <td className="font-mono">{drift.p_value !== null ? drift.p_value : 'N/A (PSI)'}</td>
                    <td>
                      <span className={`badge ${getSeverityBadgeClass(drift.severity)}`}>
                        {drift.severity}
                      </span>
                    </td>
                    <td className="col-text">{drift.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

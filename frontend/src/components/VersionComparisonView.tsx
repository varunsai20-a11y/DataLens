import React from 'react';
import { VersionComparison } from '../types';

interface VersionComparisonViewProps {
  comparison: VersionComparison;
  onClose?: () => void;
}

export const VersionComparisonView: React.FC<VersionComparisonViewProps> = ({ comparison, onClose }) => {
  const { metrics_summary, schema_drift, distribution_drift } = comparison.comparison_result;
  const scoreDelta = comparison.score_delta;

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
      case 'SEVERE_DRIFT':
        return 'badge-error';
      case 'HIGH':
      case 'MODERATE_DRIFT':
        return 'badge-warning';
      default:
        return 'badge-success';
    }
  };

  return (
    <div className="version-comparison-view" style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <div>
          <h2>Version Comparison Report</h2>
          <p style={{ color: '#64748b', margin: 0 }}>Comparing base version against target version</p>
        </div>
        {onClose && (
          <button className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      {/* Health & Drift Summary Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Intrinsic Data Quality</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>
            {metrics_summary.intrinsic_quality_score ?? metrics_summary.target_quality_score} / 100
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Internal validity & completeness</div>
        </div>

        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #eab308' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Drift Impact Score</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: (metrics_summary.drift_impact_score ?? 100) < 60 ? '#dc2626' : '#1e293b' }}>
            {metrics_summary.drift_impact_score ?? 100} / 100
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Regression vs previous version</div>
        </div>

        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #06b6d4' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Combined Health Score</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: (metrics_summary.combined_health_score ?? metrics_summary.target_quality_score) < 75 ? '#d97706' : '#16a34a' }}>
            {metrics_summary.combined_health_score ?? metrics_summary.target_quality_score} / 100
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>60% Intrinsic + 40% Drift</div>
        </div>

        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #a855f7' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Version Health Status</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '4px' }}>
            <span className={`badge ${
              metrics_summary.health_status === 'HEALTHY' ? 'badge-success' :
              metrics_summary.health_status === 'STABLE' ? 'badge-primary' :
              metrics_summary.health_status === 'AT_RISK' ? 'badge-warning' : 'badge-error'
            }`} style={{ padding: '6px 12px', fontSize: '14px' }}>
              {metrics_summary.health_status || 'HEALTHY'}
            </span>
          </div>
        </div>
      </div>

      {/* Warning banner if health status is AT_RISK, DEGRADED, or CRITICAL */}
      {metrics_summary.health_status && ['AT_RISK', 'DEGRADED', 'CRITICAL'].includes(metrics_summary.health_status) && (
        <div className="alert alert-error" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontWeight: 'bold' }}>
          ⚠️ Significant changes detected compared with the previous version. Intrinsic quality remains clean, but structural/distribution regression has lowered the Version Health Status to {metrics_summary.health_status}.
        </div>
      )}

      {/* KPI Delta Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Quality Score Delta</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: scoreDelta >= 0 ? '#16a34a' : '#dc2626' }}>
            {scoreDelta >= 0 ? `+${scoreDelta.toFixed(1)}` : scoreDelta.toFixed(1)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Base: {metrics_summary.base_quality_score} → Target: {metrics_summary.target_quality_score}
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #6366f1' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Row Count Delta</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>
            {metrics_summary.row_count_delta >= 0 ? `+${metrics_summary.row_count_delta}` : metrics_summary.row_count_delta}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Base: {metrics_summary.base_row_count} → Target: {metrics_summary.target_row_count}
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Column Count Delta</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>
            {metrics_summary.column_count_delta >= 0 ? `+${metrics_summary.column_count_delta}` : metrics_summary.column_count_delta}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Base: {metrics_summary.base_column_count} → Target: {metrics_summary.target_column_count}
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #ec4899' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>Missingness Shift</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: metrics_summary.missing_percentage_delta <= 0 ? '#16a34a' : '#dc2626' }}>
            {metrics_summary.missing_percentage_delta >= 0 ? `+${metrics_summary.missing_percentage_delta}%` : `${metrics_summary.missing_percentage_delta}%`}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Base: {metrics_summary.base_missing_percentage}% → Target: {metrics_summary.target_missing_percentage}%
          </div>
        </div>
      </div>

      {/* Schema Drift Section */}
      <div style={{ marginBottom: '32px' }}>
        <h3>1. Schema Drift Analysis ({schema_drift.length} Changes Detected)</h3>
        {schema_drift.length === 0 ? (
          <div className="alert alert-success" style={{ background: '#f0fdf4', color: '#166534', padding: '12px', borderRadius: '6px' }}>
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
                  <th>Diagnostic Message</th>
                </tr>
              </thead>
              <tbody>
                {schema_drift.map((drift, idx) => (
                  <tr key={idx}>
                    <td className="font-mono" style={{ fontWeight: 'bold' }}>{drift.column}</td>
                    <td>
                      <span className={`badge ${drift.change_type === 'REMOVED' ? 'badge-error' : drift.change_type === 'TYPE_CHANGED' ? 'badge-warning' : 'badge-primary'}`}>
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
                    <td>{drift.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Distribution Drift Section */}
      <div>
        <h3>2. Statistical & Distribution Drift ({distribution_drift.length} Features Tested)</h3>
        {distribution_drift.length === 0 ? (
          <div style={{ color: '#64748b', fontStyle: 'italic' }}>No common features available for distribution drift testing.</div>
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
                  <th>Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {distribution_drift.map((drift, idx) => (
                  <tr key={idx}>
                    <td className="font-mono" style={{ fontWeight: 'bold' }}>{drift.column}</td>
                    <td><span className="badge badge-neutral">{drift.feature_type}</span></td>
                    <td>{drift.method}</td>
                    <td className="font-mono">{drift.statistic}</td>
                    <td className="font-mono">{drift.p_value !== null ? drift.p_value : 'N/A (PSI)'}</td>
                    <td>
                      <span className={`badge ${getSeverityBadgeClass(drift.severity)}`}>
                        {drift.severity}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px' }}>{drift.interpretation}</td>
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

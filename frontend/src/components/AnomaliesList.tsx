import React from 'react';
import { QualityIssue, OutlierReport } from '../types';

interface AnomaliesListProps {
  issues: QualityIssue[];
  outliers: OutlierReport[];
}

export const AnomaliesList: React.FC<AnomaliesListProps> = ({ issues, outliers }) => {
  const getSeverityClass = (sev: string) => {
    switch (sev.toUpperCase()) {
      case 'CRITICAL': return 'critical';
      case 'HIGH': return 'high';
      case 'MEDIUM': return 'medium';
      case 'LOW': return 'low';
      default: return 'low';
    }
  };

  return (
    <div className="report-section">
      <h3 className="section-title">Quality Issues</h3>
      <div className="issue-list">
        {issues.length === 0 ? (
          <p className="text-muted">No quality issues detected.</p>
        ) : (
          issues.map((issue, idx) => (
            <div key={idx} className={`issue-item ${getSeverityClass(issue.severity)}`}>
              <div className="issue-header">
                <span className={`badge badge-${issue.severity.toLowerCase()}`}>{issue.severity}</span>
                <span className="issue-msg">{issue.message}</span>
              </div>
              <div className="issue-meta">
                {issue.column && <span>Column: {issue.column}</span>}
                {issue.affected_percentage > 0 && (
                  <span style={{ marginLeft: '0.5rem' }}>
                    Affected: {issue.affected_percentage}%
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <h3 className="section-title" style={{ marginTop: '2rem' }}>Statistical Outliers</h3>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Column</th>
              <th>Outliers</th>
              <th>% of Column</th>
              <th>Bounds (L/U)</th>
            </tr>
          </thead>
          <tbody>
            {outliers.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-muted">No statistical outliers detected.</td>
              </tr>
            ) : (
              outliers.map((out, idx) => (
                <tr key={idx}>
                  <td>{out.column}</td>
                  <td>{out.outlier_count}</td>
                  <td>{out.outlier_percentage}%</td>
                  <td className="font-mono">{out.lower_bound} / {out.upper_bound}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

import React from 'react';
import { QualityHistoryItem } from '../types';

interface HistoricalTrendChartProps {
  history: QualityHistoryItem[];
}

export const HistoricalTrendChart: React.FC<HistoricalTrendChartProps> = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div className="empty-state">
        <p>No historical quality data available yet. Run analysis on dataset versions to track trends.</p>
      </div>
    );
  }

  const maxScore = 100;
  const chartHeight = 160;
  const chartWidth = 500;
  const padding = 30;

  const points = history.map((item, idx) => {
    const x = padding + (idx / Math.max(history.length - 1, 1)) * (chartWidth - 2 * padding);
    const y = chartHeight - padding - (item.overall_quality_score / maxScore) * (chartHeight - 2 * padding);
    return { x, y, item };
  });

  const pathD = points.length === 1
    ? `M ${points[0].x} ${points[0].y} L ${chartWidth - padding} ${points[0].y}`
    : points.reduce((acc, curr, i) => (i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`), '');

  return (
    <div className="historical-trend-card">
      <div className="card-header">
        <h3>Quality Score History & Version Progression</h3>
      </div>
      <div className="trend-content" style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <svg width={chartWidth} height={chartHeight} style={{ overflow: 'visible', background: '#f8fafc', borderRadius: '8px', padding: '10px' }}>
          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#e2e8f0" strokeDasharray="4" />
          <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#e2e8f0" strokeDasharray="4" />
          <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#cbd5e1" />

          {/* Trend Line */}
          <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="3" />

          {/* Data Points */}
          {points.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="6" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
              <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1e293b">
                {p.item.overall_quality_score.toFixed(1)}
              </text>
              <text x={p.x} y={chartHeight - 8} textAnchor="middle" fontSize="11" fill="#64748b">
                v{p.item.version_number}
              </text>
            </g>
          ))}
        </svg>

        {/* History Table */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Intrinsic Quality</th>
                <th>Combined Health</th>
                <th>Status</th>
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.version_id}>
                  <td>
                    <span className="badge badge-primary">v{item.version_number}</span>
                  </td>
                  <td style={{ fontWeight: 'bold' }}>
                    {(item.intrinsic_quality_score ?? item.overall_quality_score).toFixed(1)}
                  </td>
                  <td style={{ fontWeight: 'bold', color: (item.combined_health_score ?? item.overall_quality_score) >= 80 ? '#16a34a' : (item.combined_health_score ?? item.overall_quality_score) >= 60 ? '#d97706' : '#dc2626' }}>
                    {(item.combined_health_score ?? item.overall_quality_score).toFixed(1)}
                  </td>
                  <td>
                    <span className={`badge ${
                      (item.health_status || 'HEALTHY') === 'HEALTHY' ? 'badge-success' :
                      (item.health_status || 'HEALTHY') === 'STABLE' ? 'badge-primary' :
                      (item.health_status || 'HEALTHY') === 'AT_RISK' ? 'badge-warning' : 'badge-error'
                    }`} style={{ fontSize: '11px' }}>
                      {item.health_status || 'HEALTHY'}
                    </span>
                  </td>
                  <td>{item.issue_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

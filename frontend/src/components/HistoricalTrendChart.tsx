import React from 'react';
import { QualityHistoryItem } from '../types';

interface HistoricalTrendChartProps {
  history: QualityHistoryItem[];
}

export const HistoricalTrendChart: React.FC<HistoricalTrendChartProps> = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div style={{ backgroundColor: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>No historical quality data available yet. Run analysis on dataset versions to track trends.</p>
      </div>
    );
  }

  // Deduplicate by version_number to present 1 point per dataset version (latest analysis run for each version)
  const latestPerVersionMap = new Map<number, QualityHistoryItem>();
  history.forEach(item => {
    const existing = latestPerVersionMap.get(item.version_number);
    if (!existing || new Date(item.created_at || 0).getTime() >= new Date(existing.created_at || 0).getTime()) {
      latestPerVersionMap.set(item.version_number, item);
    }
  });

  const displayHistory = Array.from(latestPerVersionMap.values()).sort((a, b) => a.version_number - b.version_number);

  const maxScore = 100;
  const chartHeight = 160;
  const chartWidth = 500;
  const padding = 30;

  const points = displayHistory.map((item, idx) => {
    const score = Number(item.overall_quality_score || 0);
    const x = padding + (idx / Math.max(displayHistory.length - 1, 1)) * (chartWidth - 2 * padding);
    const y = chartHeight - padding - (score / maxScore) * (chartHeight - 2 * padding);
    return { x, y, score, item };
  });

  const pathD = points.length === 1
    ? `M ${points[0].x} ${points[0].y} L ${chartWidth - padding} ${points[0].y}`
    : points.reduce((acc, curr, i) => (i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`), '');

  return (
    <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>Latest Quality Trend by Version</h3>
        <span className="badge badge-primary">{displayHistory.length} Versions</span>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <svg width={chartWidth} height={chartHeight} style={{ overflow: 'visible', background: 'var(--bg-app)', borderRadius: '10px', padding: '10px', border: '1px solid var(--border-color)' }}>
          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#1e293b" strokeDasharray="4" />
          <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#1e293b" strokeDasharray="4" />
          <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#334155" />

          {/* Gradient Definition */}
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>

          {/* Trend Line */}
          <path d={pathD} fill="none" stroke="url(#lineGrad)" strokeWidth="3.5" />

          {/* Data Points */}
          {points.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="6" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
              <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#ffffff">
                {p.score.toFixed(1)}
              </text>
              <text x={p.x} y={chartHeight - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
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
              {displayHistory.map((item) => {
                const intrinsic = Number(item.intrinsic_quality_score ?? item.overall_quality_score ?? 0);
                const combined = Number(item.combined_health_score ?? item.overall_quality_score ?? 0);
                return (
                  <tr key={item.version_id}>
                    <td>
                      <span className="badge badge-primary">v{item.version_number}</span>
                    </td>
                    <td style={{ fontWeight: 'bold', color: '#ffffff' }}>
                      {intrinsic.toFixed(1)}
                    </td>
                    <td style={{ fontWeight: 'bold', color: combined >= 80 ? 'var(--success-text)' : combined >= 60 ? 'var(--warning-text)' : 'var(--danger-text)' }}>
                      {combined.toFixed(1)}
                    </td>
                    <td>
                      <span className={`badge ${
                        (item.health_status || 'HEALTHY') === 'HEALTHY' ? 'badge-success' :
                        (item.health_status || 'HEALTHY') === 'STABLE' ? 'badge-primary' :
                        (item.health_status || 'HEALTHY') === 'AT_RISK' ? 'badge-warning' : 'badge-danger'
                      }`} style={{ fontSize: '10px' }}>
                        {item.health_status || 'HEALTHY'}
                      </span>
                    </td>
                    <td>{item.issue_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

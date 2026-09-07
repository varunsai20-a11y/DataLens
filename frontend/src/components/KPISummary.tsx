import React from 'react';
import { DatasetSummary } from '../types';

interface KPISummaryProps {
  summary: DatasetSummary;
}

export const KPISummary: React.FC<KPISummaryProps> = ({ summary }) => {
  const rowCount = Number(summary?.row_count || 0);
  const colCount = Number(summary?.column_count || 0);
  const missingPct = Number(summary?.total_missing_percentage || 0);
  const missingCells = Number(summary?.total_missing_cells || 0);
  const dupPct = Number(summary?.duplicate_row_percentage || 0);
  const dupCount = Number(summary?.duplicate_row_count || 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
      <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.04em' }}>TOTAL ROWS</div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', margin: '0.2rem 0' }}>{rowCount.toLocaleString()}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Dataset Volume</div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.04em' }}>TOTAL COLUMNS</div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', margin: '0.2rem 0' }}>{colCount}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Feature Cardinality</div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.04em' }}>MISSINGNESS</div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: missingPct > 20 ? 'var(--danger-text)' : '#ffffff', margin: '0.2rem 0' }}>
          {missingPct.toFixed(1)}%
        </div>
        <div style={{ fontSize: '0.75rem', color: missingPct > 20 ? 'var(--danger-text)' : 'var(--text-subtle)' }}>
          {missingCells.toLocaleString()} missing cells
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.04em' }}>DUPLICATE ROWS</div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: dupPct > 10 ? 'var(--warning-text)' : '#ffffff', margin: '0.2rem 0' }}>
          {dupPct.toFixed(1)}%
        </div>
        <div style={{ fontSize: '0.75rem', color: dupPct > 10 ? 'var(--warning-text)' : 'var(--text-subtle)' }}>
          {dupCount.toLocaleString()} duplicate rows
        </div>
      </div>
    </div>
  );
};

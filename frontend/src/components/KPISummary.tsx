import React from 'react';
import { DatasetSummary } from '../types';

interface KPISummaryProps {
  summary: DatasetSummary;
}

export const KPISummary: React.FC<KPISummaryProps> = ({ summary }) => {
  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <div className="kpi-label">Total Rows</div>
        <div className="kpi-value">{summary.row_count.toLocaleString()}</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Total Columns</div>
        <div className="kpi-value">{summary.column_count}</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Missingness</div>
        <div className="kpi-value">{summary.total_missing_percentage}%</div>
        <div className={`kpi-subtext ${summary.total_missing_percentage > 20 ? 'text-danger' : ''}`}>
          {summary.total_missing_cells} missing cells
        </div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Duplicates</div>
        <div className="kpi-value">{summary.duplicate_row_percentage}%</div>
        <div className={`kpi-subtext ${summary.duplicate_row_percentage > 10 ? 'text-danger' : ''}`}>
          {summary.duplicate_row_count} duplicate rows
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { ColumnProfile } from '../types';

interface ProfilingTableProps {
  columns: ColumnProfile[];
}

export const ProfilingTable: React.FC<ProfilingTableProps> = ({ columns }) => {
  if (!columns || columns.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '1rem 0' }}>
        No column profiling metrics available for this report.
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Column Name</th>
            <th>Inferred Type</th>
            <th>Null %</th>
            <th>Uniqueness %</th>
            <th>Range (Min / Max)</th>
            <th>Central Tendency (Mean / Median)</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col) => {
            const nullPct = Number(col.missing_percentage || 0);
            const uniqPct = Number(col.uniqueness_percentage || 0);
            return (
              <tr key={col.name}>
                <td className="font-mono" style={{ fontWeight: 700, color: '#ffffff' }}>{col.name}</td>
                <td>
                  <span className="badge badge-neutral">{col.inferred_type || col.dtype}</span>
                </td>
                <td style={{ color: nullPct > 15 ? 'var(--danger-text)' : 'inherit', fontWeight: nullPct > 15 ? 700 : 400 }}>
                  {nullPct.toFixed(1)}%
                </td>
                <td>{uniqPct.toFixed(1)}%</td>
                <td className="font-mono">
                  {col.min !== undefined && col.min !== null && col.max !== undefined && col.max !== null
                    ? `${col.min} / ${col.max}`
                    : '—'}
                </td>
                <td className="font-mono">
                  {col.mean !== undefined && col.mean !== null && col.median !== undefined && col.median !== null
                    ? `${typeof col.mean === 'number' ? col.mean.toFixed(2) : col.mean} / ${typeof col.median === 'number' ? col.median.toFixed(2) : col.median}`
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

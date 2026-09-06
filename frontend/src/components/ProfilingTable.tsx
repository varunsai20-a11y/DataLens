import React from 'react';
import { ColumnProfile } from '../types';

interface ProfilingTableProps {
  columns: ColumnProfile[];
}

export const ProfilingTable: React.FC<ProfilingTableProps> = ({ columns }) => {
  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Column</th>
            <th>Type</th>
            <th>Null %</th>
            <th>Uniqueness %</th>
            <th>Range (Min/Max)</th>
            <th>Center (Mean/Median)</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col) => (
            <tr key={col.name}>
              <td className="font-weight-600">{col.name}</td>
              <td>
                <span className="badge badge-neutral">{col.inferred_type}</span>
              </td>
              <td>{col.missing_percentage}%</td>
              <td>{col.uniqueness_percentage}%</td>
              <td>
                {col.min !== null && col.max !== null
                  ? `${col.min} / ${col.max}`
                  : '—'}
              </td>
              <td>
                {col.mean !== null && col.median !== null
                  ? `${col.mean} / ${col.median}`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

import React from 'react';
import { ScoreDimensions } from '../types';

interface QualityScoreCardProps {
  score: number;
  dimensions: ScoreDimensions;
  grade: string;
}

export const QualityScoreCard: React.FC<QualityScoreCardProps> = ({ score, dimensions, grade }) => {
  const numScore = Number(score || 0);

  const getGaugeColor = (val: number) => {
    if (val >= 90) return { border: '#10b981', color: '#34d399', shadow: 'var(--glow-emerald)' };
    if (val >= 80) return { border: '#3b82f6', color: '#60a5fa', shadow: 'var(--glow-blue)' };
    if (val >= 70) return { border: '#f59e0b', color: '#fbbf24', shadow: 'var(--glow-amber)' };
    return { border: '#ef4444', color: '#f87171', shadow: '0 0 20px rgba(239, 68, 68, 0.25)' };
  };

  const style = getGaugeColor(numScore);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', width: '100%' }}>
      {/* Score Circular Meter */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '140px',
          height: '140px',
          borderRadius: '50%',
          border: `6px solid ${style.border}`,
          backgroundColor: 'var(--bg-app)',
          boxShadow: style.shadow,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '2.25rem', fontWeight: 800, color: style.color, lineHeight: 1 }}>
          {numScore.toFixed(0)}
        </span>
        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ffffff', marginTop: '0.3rem', letterSpacing: '0.05em' }}>
          GRADE {grade}
        </span>
      </div>

      {/* Dimensional Quality Bars */}
      <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {Object.entries(dimensions || {}).map(([key, value]) => {
          const valNum = Number(value || 0);
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700 }}>
                <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                  {key.replace('outlier_quality', 'Outlier Quality')}
                </span>
                <span className="font-mono" style={{ color: '#ffffff' }}>{valNum.toFixed(1)}%</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--bg-app)', borderRadius: '9999px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${valNum}%`,
                    background: valNum >= 80 ? 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)' : 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)',
                    borderRadius: '9999px',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

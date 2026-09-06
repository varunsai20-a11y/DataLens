import React from 'react';
import { AnalysisResult, ScoreDimensions } from '../types';

interface QualityScoreCardProps {
  score: number;
  dimensions: ScoreDimensions;
  grade: string;
}

export const QualityScoreCard: React.FC<QualityScoreCardProps> = ({ score, dimensions, grade }) => {
  const getGradeClass = (g: string) => {
    const lower = g.toLowerCase();
    if (lower === 'a') return 'grade-a';
    if (lower === 'b') return 'grade-b';
    if (lower === 'c') return 'grade-c';
    if (lower === 'd') return 'grade-d';
    return 'grade-f';
  };

  return (
    <div className="score-card">
      <div className={`score-gauge ${getGradeClass(grade)}`}>
        <span className="score-number">{score}</span>
        <span className="score-grade">Grade {grade}</span>
      </div>

      <div className="dimension-bars">
        {Object.entries(dimensions).map(([key, value]) => (
          <div key={key} className="dimension-bar-item">
            <div className="dimension-bar-header">
              <span className="text-muted" style={{ textTransform: 'capitalize' }}>
                {key.replace('outlier_quality', 'Outlier Quality')}
              </span>
              <span className="font-mono">{value}%</span>
            </div>
            <div className="dimension-bar-track">
              <div
                className="dimension-bar-fill"
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

import React from 'react';
import { Recommendation } from '../types';

interface RecommendationsPanelProps {
  recommendations: Recommendation[];
}

export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({ recommendations }) => {
  return (
    <div className="report-section">
      <h3 className="section-title">Remediation Recommendations</h3>
      <div className="rec-list">
        {recommendations.length === 0 ? (
          <p className="text-muted">No recommendations available for this dataset.</p>
        ) : (
          recommendations.map((rec, idx) => (
            <div key={idx} className="rec-card">
              <div className="rec-header">
                <span className="badge badge-neutral">{rec.category}</span>
                <span className={`badge badge-${rec.priority.toLowerCase()}`}>{rec.priority} Priority</span>
              </div>
              <div className="rec-body">
                {rec.message}
              </div>
              <div className="rec-suggestion">
                <strong>Suggested Fix:</strong> {rec.suggestion}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

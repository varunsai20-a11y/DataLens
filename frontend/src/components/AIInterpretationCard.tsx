import React, { useEffect, useState } from 'react';
import { AIInterpretation } from '../types';
import { api } from '../services/api';

interface AIInterpretationCardProps {
  datasetId?: string;
  versionId?: string;
  interpretation?: AIInterpretation | null;
}

export const AIInterpretationCard: React.FC<AIInterpretationCardProps> = ({
  datasetId,
  versionId,
  interpretation: initialInterpretation,
}) => {
  const [data, setData] = useState<AIInterpretation | null>(initialInterpretation || null);
  const [loading, setLoading] = useState<boolean>(!initialInterpretation && !!datasetId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialInterpretation) {
      setData(initialInterpretation);
      return;
    }

    if (!datasetId) return;

    let isMounted = true;
    const fetchAI = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getAIInterpretation(datasetId, versionId);
        if (isMounted) {
          setData(result);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.response?.data?.message || err.message || 'Failed to fetch AI interpretation.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAI();

    return () => {
      isMounted = false;
    };
  }, [datasetId, versionId, initialInterpretation]);

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return <span className="badge badge-error" style={{ background: '#991b1b', color: '#fff', fontWeight: 'bold' }}>CRITICAL SEVERITY</span>;
      case 'HIGH':
        return <span className="badge badge-error" style={{ fontWeight: 'bold' }}>HIGH SEVERITY</span>;
      case 'MEDIUM':
        return <span className="badge badge-warning" style={{ fontWeight: 'bold' }}>MEDIUM SEVERITY</span>;
      default:
        return <span className="badge badge-success" style={{ fontWeight: 'bold' }}>LOW SEVERITY</span>;
    }
  };

  if (loading) {
    return (
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="job-spinner" style={{ width: '24px', height: '24px' }}></div>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Generating AI Data Quality Interpretation...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: '#fef2f2', padding: '16px 20px', borderRadius: '12px', border: '1px solid #fca5a5', color: '#991b1b', marginBottom: '24px' }}>
        <strong>AI Interpretation Unavailable:</strong> {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const isFallback = data.source === 'FALLBACK';

  return (
    <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #cbd5e1', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🧠</span>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>AI Data Quality Interpretation</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {getSeverityBadge(data.severity)}
          <span style={{
            fontSize: '12px',
            padding: '4px 10px',
            borderRadius: '20px',
            background: isFallback ? '#fef3c7' : '#e0e7ff',
            color: isFallback ? '#92400e' : '#3730a3',
            fontWeight: 600
          }}>
            {isFallback ? '⚡ Rule-Based Fallback' : '✨ AI (gpt-4o-mini)'}
          </span>
        </div>
      </div>

      {/* Summary Box */}
      <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #2563eb', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>
          Executive Summary
        </div>
        <p style={{ margin: 0, color: '#334155', fontSize: '15px', lineHeight: '1.6' }}>
          {data.summary}
        </p>
      </div>

      {/* Findings, Causes & Actions Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {/* Key Findings */}
        <div style={{ background: '#fafafa', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🔍 Key Findings
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#475569', fontSize: '13px', lineHeight: '1.6' }}>
            {data.key_findings.map((finding, idx) => (
              <li key={idx} style={{ marginBottom: '6px' }}>{finding}</li>
            ))}
          </ul>
        </div>

        {/* Likely Causes */}
        <div style={{ background: '#fafafa', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            💡 Likely Root Causes
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#475569', fontSize: '13px', lineHeight: '1.6' }}>
            {data.likely_causes.map((cause, idx) => (
              <li key={idx} style={{ marginBottom: '6px' }}>{cause}</li>
            ))}
          </ul>
        </div>

        {/* Recommended Actions */}
        <div style={{ background: '#fafafa', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🛠️ Recommended Actions
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#475569', fontSize: '13px', lineHeight: '1.6' }}>
            {data.recommended_actions.map((action, idx) => (
              <li key={idx} style={{ marginBottom: '6px' }}>{action}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

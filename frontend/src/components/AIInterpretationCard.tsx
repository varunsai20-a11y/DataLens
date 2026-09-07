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
          setError(err.response?.data?.message || err.message || 'Failed to fetch DataLens Intelligence summary.');
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
        return <span className="badge badge-danger">CRITICAL SEVERITY</span>;
      case 'HIGH':
        return <span className="badge badge-danger">HIGH SEVERITY</span>;
      case 'MEDIUM':
        return <span className="badge badge-warning">MEDIUM SEVERITY</span>;
      default:
        return <span className="badge badge-success">LOW SEVERITY</span>;
    }
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="job-spinner" style={{ width: '1.25rem', height: '1.25rem' }}></div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>Synthesizing DataLens Intelligence Summary...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ backgroundColor: 'var(--danger-light)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        <strong>DataLens Intelligence Notice:</strong> {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const isFallback = data.source === 'FALLBACK';

  return (
    <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.75rem', borderRadius: '14px', border: '1px solid var(--primary-border)', marginBottom: '2rem', boxShadow: 'var(--glow-blue)' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '1rem' }}>
            🤖
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>DataLens Intelligence</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Autonomous Root Cause & Quality Diagnostics</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {getSeverityBadge(data.severity)}
          <span className={`badge ${isFallback ? 'badge-warning' : 'badge-primary'}`}>
            {isFallback ? '⚡ RULE-BASED FALLBACK' : '✨ ACTUAL AI (GPT-4O-MINI)'}
          </span>
        </div>
      </div>

      {/* Executive Summary Box */}
      <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem 1.25rem', borderRadius: '10px', borderLeft: '4px solid #3b82f6', marginBottom: '1.5rem', border: '1px solid var(--border-color)', borderLeftWidth: '4px' }}>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#60a5fa', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
          EXECUTIVE SUMMARY
        </div>
        <p style={{ margin: 0, color: '#f3f4f6', fontSize: '0.95rem', lineHeight: '1.6' }}>
          {data.summary}
        </p>
      </div>

      {/* Findings, Causes & Actions Grid */}
      <div className="ai-cards-grid">
        {/* Key Findings */}
        <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem', borderRadius: '10px', border: '1px solid var(--border-color)', minWidth: 0 }}>
          <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.875rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            🔍 Key Findings
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.825rem', lineHeight: '1.6', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            {data.key_findings.map((finding, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem' }}>{finding}</li>
            ))}
          </ul>
        </div>

        {/* Likely Causes */}
        <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem', borderRadius: '10px', border: '1px solid var(--border-color)', minWidth: 0 }}>
          <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.875rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            💡 Likely Root Causes
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.825rem', lineHeight: '1.6', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            {data.likely_causes.map((cause, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem' }}>{cause}</li>
            ))}
          </ul>
        </div>

        {/* Recommended Actions */}
        <div style={{ backgroundColor: 'var(--bg-app)', padding: '1.15rem', borderRadius: '10px', border: '1px solid var(--border-color)', minWidth: 0 }}>
          <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.875rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            🛠️ Recommended Actions
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.825rem', lineHeight: '1.6', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            {data.recommended_actions.map((action, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem' }}>{action}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

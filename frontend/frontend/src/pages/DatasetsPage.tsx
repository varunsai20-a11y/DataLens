import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Dataset, DatasetVersion, AnalysisJob } from '../types';
import { DatasetUploadModal } from '../components/DatasetUploadModal';

interface DatasetsPageProps {
  onViewReport: (jobId?: string, versionId?: string) => void;
}

export const DatasetsPage: React.FC<DatasetsPageProps> = ({ onViewReport }) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected dataset for version view
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState<boolean>(false);

  // Create Dataset Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newDatasetName, setNewDatasetName] = useState<string>('');
  const [newDatasetDesc, setNewDatasetDesc] = useState<string>('');
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Upload Version Modal
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);

  // Active Job Polling
  const [activeJob, setActiveJob] = useState<AnalysisJob | null>(null);
  const [jobVersionId, setJobVersionId] = useState<string | null>(null);

  const fetchDatasets = async (selectId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listDatasets();
      setDatasets(data);
      if (data.length > 0) {
        const target = selectId ? data.find((d) => d.id === selectId) || data[0] : selectedDataset || data[0];
        selectDataset(target);
      } else {
        setSelectedDataset(null);
        setVersions([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load datasets');
    } finally {
      setLoading(false);
    }
  };

  const selectDataset = async (ds: Dataset) => {
    setSelectedDataset(ds);
    setLoadingVersions(true);
    try {
      const res = await api.getDataset(ds.id);
      setVersions(res.versions || []);
    } catch (err: any) {
      console.error('Failed to load dataset versions', err);
    } finally {
      setLoadingVersions(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  // Poll active analysis job
  useEffect(() => {
    if (!activeJob || activeJob.status === 'COMPLETED' || activeJob.status === 'FAILED') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const job = await api.getJobStatus(activeJob.id);
        setActiveJob(job);
        if (job.status === 'COMPLETED' || job.status === 'FAILED') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to poll job status', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeJob]);

  const handleCreateDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDatasetName.trim()) return;

    setCreateLoading(true);
    setCreateError(null);
    try {
      const created = await api.createDataset(newDatasetName.trim(), newDatasetDesc.trim() || undefined);
      setShowCreateModal(false);
      setNewDatasetName('');
      setNewDatasetDesc('');
      await fetchDatasets(created.id);
    } catch (err: any) {
      setCreateError(err.response?.data?.message || err.message || 'Failed to create dataset');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRunAnalysis = async (versionId: string) => {
    try {
      setJobVersionId(versionId);
      const res = await api.runAnalysis(versionId);
      setActiveJob({
        id: res.job_id,
        dataset_version_id: versionId,
        status: res.job_status as any,
        error_message: null,
        started_at: new Date().toISOString(),
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to start analysis job');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="datasets-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Datasets</h1>
          <p className="page-subtitle">Register datasets, upload versions, and execute automated reliability audits.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + New Dataset
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Active Analysis Banner */}
      {activeJob && (
        <div className={`job-banner ${activeJob.status.toLowerCase()}`}>
          <div className="job-banner-content">
            <span className="job-spinner"></span>
            <div>
              <strong>Analysis Job: {activeJob.id.slice(0, 8)}...</strong>
              <span className="job-status-pill">{activeJob.status}</span>
              <p className="job-status-desc">
                {activeJob.status === 'PENDING' && 'Job is queued for processing...'}
                {activeJob.status === 'PROCESSING' && 'Python Data Engine is computing statistics, outliers, and quality checks...'}
                {activeJob.status === 'COMPLETED' && 'Analysis completed successfully!'}
                {activeJob.status === 'FAILED' && `Analysis failed: ${activeJob.error_message || 'Unknown error'}`}
              </p>
            </div>
          </div>
          {activeJob.status === 'COMPLETED' && (
            <button
              className="btn btn-success"
              onClick={() => onViewReport(activeJob.id, jobVersionId || undefined)}
            >
              View Report →
            </button>
          )}
        </div>
      )}

      <div className="datasets-layout">
        {/* Left: Datasets List */}
        <div className="datasets-sidebar">
          <div className="sidebar-header">
            <h3>Registered Datasets ({datasets.length})</h3>
          </div>
          {loading ? (
            <div className="loading-state">Loading datasets...</div>
          ) : datasets.length === 0 ? (
            <div className="empty-state" style={{ padding: '1rem', textAlign: 'center' }}>
              <p className="text-muted" style={{ marginBottom: '0.75rem' }}>No datasets registered yet.</p>
              <button className="btn btn-sm btn-primary" onClick={() => setShowCreateModal(true)}>
                Create First Dataset
              </button>
            </div>
          ) : (
            <div className="dataset-list">
              {datasets.map((ds) => (
                <div
                  key={ds.id}
                  className={`dataset-card ${selectedDataset?.id === ds.id ? 'selected' : ''}`}
                  onClick={() => selectDataset(ds)}
                >
                  <div className="dataset-card-header">
                    <h4>{ds.name}</h4>
                    <span className="badge badge-neutral">{ds.version_count || 0} v</span>
                  </div>
                  {ds.description && <p className="dataset-card-desc">{ds.description}</p>}
                  <div className="dataset-card-footer">
                    <span>Updated: {new Date(ds.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Dataset Detail & Version History */}
        <div className="dataset-details">
          {selectedDataset ? (
            <div>
              <div className="details-header">
                <div>
                  <h2>{selectedDataset.name}</h2>
                  <p className="text-muted">{selectedDataset.description || 'No description provided.'}</p>
                  <span className="dataset-id-tag">ID: {selectedDataset.id}</span>
                </div>
                <button className="btn btn-secondary" onClick={() => setShowUploadModal(true)}>
                  + Upload New Version
                </button>
              </div>

              <div className="versions-section">
                <h3>Version History</h3>
                {loadingVersions ? (
                  <div className="loading-state">Loading version history...</div>
                ) : versions.length === 0 ? (
                  <div className="empty-box">
                    <p>No versions uploaded for this dataset yet.</p>
                    <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                      Upload First Version (.csv, .parquet)
                    </button>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Version</th>
                          <th>Filename</th>
                          <th>Size</th>
                          <th>Checksum</th>
                          <th>Uploaded</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {versions.map((ver) => (
                          <tr key={ver.id}>
                            <td>
                              <span className="badge badge-primary">v{ver.version_number}</span>
                            </td>
                            <td className="font-mono">{ver.original_filename}</td>
                            <td>{formatBytes(Number(ver.file_size_bytes))}</td>
                            <td className="font-mono text-muted">{ver.checksum.slice(0, 8)}...</td>
                            <td>{new Date(ver.created_at).toLocaleString()}</td>
                            <td>
                              <div className="action-buttons">
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => handleRunAnalysis(ver.id)}
                                >
                                  ▶ Run Analysis
                                </button>
                                <button
                                  className="btn btn-sm btn-outline"
                                  onClick={() => onViewReport(undefined, ver.id)}
                                >
                                  View Report
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-box">
              <p>Select a dataset to view its version history or create a new one.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Dataset Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Create New Dataset</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleCreateDataset}>
              <div className="modal-body">
                {createError && <div className="alert alert-error">{createError}</div>}
                <div className="form-group">
                  <label>Dataset Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. customer_transactions_q3"
                    value={newDatasetName}
                    onChange={(e) => setNewDatasetName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Brief summary of dataset contents, source, or purpose"
                    value={newDatasetDesc}
                    onChange={(e) => setNewDatasetDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={createLoading}>
                  {createLoading ? 'Creating...' : 'Create Dataset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Version Modal */}
      {showUploadModal && selectedDataset && (
        <DatasetUploadModal
          dataset={selectedDataset}
          onClose={() => setShowUploadModal(false)}
          onSuccess={async () => {
            await selectDataset(selectedDataset);
            await fetchDatasets(selectedDataset.id);
          }}
        />
      )}
    </div>
  );
};

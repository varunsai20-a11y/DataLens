import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Dataset, DatasetVersion, AnalysisJob, QualityHistoryItem, VersionComparison } from '../types';
import { HistoricalTrendChart } from '../components/HistoricalTrendChart';
import { VersionComparisonView } from '../components/VersionComparisonView';

interface DatasetsPageProps {
  onViewReport: (jobId?: string, versionId?: string) => void;
}

export const DatasetsPage: React.FC<DatasetsPageProps> = ({ onViewReport }) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected dataset & version state
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState<boolean>(false);
  const [history, setHistory] = useState<QualityHistoryItem[]>([]);

  // Version Comparison State
  const [baseVersionId, setBaseVersionId] = useState<string>('');
  const [targetVersionId, setTargetVersionId] = useState<string>('');
  const [compareLoading, setCompareLoading] = useState<boolean>(false);
  const [activeComparison, setActiveComparison] = useState<VersionComparison | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newDatasetName, setNewDatasetName] = useState<string>('');
  const [newDatasetDesc, setNewDatasetDesc] = useState<string>('');
  const [createLoading, setCreateLoading] = useState<boolean>(false);

  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Active Job Polling
  const [activeJob, setActiveJob] = useState<AnalysisJob | null>(null);
  const [jobVersionId, setJobVersionId] = useState<string | null>(null);

  const fetchDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listDatasets();
      setDatasets(data);
      if (data.length > 0 && !selectedDataset) {
        selectDataset(data[0]);
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
    setActiveComparison(null);
    try {
      const res = await api.getDataset(ds.id);
      const vers = res.versions || [];
      setVersions(vers);
      if (vers.length >= 2) {
        setBaseVersionId(vers[0].id);
        setTargetVersionId(vers[vers.length - 1].id);
      } else {
        setBaseVersionId('');
        setTargetVersionId('');
      }

      // Fetch history
      const histData = await api.getDatasetHistory(ds.id);
      setHistory(histData);
    } catch (err: any) {
      console.error('Failed to load versions/history', err);
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
        if (job.status === 'COMPLETED') {
          clearInterval(interval);
          if (selectedDataset) {
            selectDataset(selectedDataset);
          }
        } else if (job.status === 'FAILED') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to poll job status', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeJob, selectedDataset]);

  const handleCreateDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDatasetName.trim()) return;

    setCreateLoading(true);
    try {
      const created = await api.createDataset(newDatasetName.trim(), newDatasetDesc.trim() || undefined);
      setShowCreateModal(false);
      setNewDatasetName('');
      setNewDatasetDesc('');
      await fetchDatasets();
      selectDataset(created);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to create dataset');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUploadVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !selectedDataset) return;

    const ext = uploadFile.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'parquet' && ext !== 'pq') {
      setUploadError('Only CSV (.csv) and Parquet (.parquet) files are supported.');
      return;
    }

    setUploadLoading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      await api.uploadDatasetVersion(selectedDataset.id, uploadFile, (percent) => {
        setUploadProgress(percent);
      });
      setShowUploadModal(false);
      setUploadFile(null);
      await selectDataset(selectedDataset);
      await fetchDatasets();
    } catch (err: any) {
      setUploadError(err.response?.data?.message || err.message || 'Failed to upload version');
    } finally {
      setUploadLoading(false);
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

  const handleCompareVersions = async () => {
    if (!selectedDataset || !baseVersionId || !targetVersionId) return;
    if (baseVersionId === targetVersionId) {
      alert('Please select two distinct versions to compare.');
      return;
    }

    setCompareLoading(true);
    try {
      const comp = await api.compareVersions(selectedDataset.id, baseVersionId, targetVersionId);
      setActiveComparison(comp);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to compare dataset versions');
    } finally {
      setCompareLoading(false);
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
          <p className="page-subtitle">Manage dataset versions, track historical quality, and detect schema & statistical drift.</p>
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
                {activeJob.status === 'PENDING' && 'Job queued in BullMQ...'}
                {activeJob.status === 'PROCESSING' && 'Worker processing dataset analysis...'}
                {activeJob.status === 'COMPLETED' && 'Analysis completed!'}
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
            <div className="empty-state">
              <p>No datasets registered yet.</p>
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

        {/* Right: Dataset Detail, History & Comparison */}
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

              {/* Version Comparison Selector */}
              {versions.length >= 2 && (
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 12px 0' }}>Version Comparison & Drift Analysis</h4>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Base Version (V1)</label>
                      <select className="form-control" value={baseVersionId} onChange={(e) => setBaseVersionId(e.target.value)}>
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            v{v.version_number} - {v.original_filename}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Target Version (V2)</label>
                      <select className="form-control" value={targetVersionId} onChange={(e) => setTargetVersionId(e.target.value)}>
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            v{v.version_number} - {v.original_filename}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ alignSelf: 'flex-end' }}>
                      <button className="btn btn-primary" onClick={handleCompareVersions} disabled={compareLoading}>
                        {compareLoading ? 'Comparing...' : 'Compare Versions & Drift'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Comparison View */}
              {activeComparison && (
                <div style={{ marginBottom: '32px' }}>
                  <VersionComparisonView comparison={activeComparison} onClose={() => setActiveComparison(null)} />
                </div>
              )}

              {/* Historical Quality Chart */}
              {history.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                  <HistoricalTrendChart history={history} />
                </div>
              )}

              {/* Version Table */}
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
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Upload Version for {selectedDataset.name}</h3>
              <button className="modal-close" onClick={() => setShowUploadModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleUploadVersion}>
              <div className="modal-body">
                {uploadError && <div className="alert alert-error">{uploadError}</div>}
                <div className="form-group">
                  <label>Choose File (.csv or .parquet) *</label>
                  <input
                    type="file"
                    className="form-control"
                    accept=".csv,.parquet,.pq"
                    onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                    required
                  />
                  <small className="text-muted">Max file size: 100 MB.</small>
                </div>
                {uploadLoading && (
                  <div className="progress-container">
                    <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                    <span className="progress-text">{uploadProgress}% Uploaded</span>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={uploadLoading || !uploadFile}>
                  {uploadLoading ? 'Uploading...' : 'Upload Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

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
          <h1 className="page-title">Dataset Control Center</h1>
          <p className="page-subtitle">Track versions, inspect quality trends, and compute distribution & schema drift across pipelines.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + New Dataset
        </button>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {/* Active Analysis Banner */}
      {activeJob && (
        <div className={`job-banner ${activeJob.status.toLowerCase()}`}>
          <div className="job-banner-content">
            <span className="job-spinner"></span>
            <div>
              <strong>Analysis Job: <span className="font-mono">{activeJob.id.slice(0, 8)}...</span></strong>
              <span className="job-status-pill">{activeJob.status}</span>
              <p className="job-status-desc">
                {activeJob.status === 'PENDING' && 'Job enqueued in BullMQ worker queue...'}
                {activeJob.status === 'PROCESSING' && 'Worker executing Python profiling & statistical analysis...'}
                {activeJob.status === 'COMPLETED' && 'Analysis completed and saved to PostgreSQL!'}
                {activeJob.status === 'FAILED' && `Analysis failed: ${activeJob.error_message || 'Unknown error'}`}
              </p>
            </div>
          </div>
          {activeJob.status === 'COMPLETED' && (
            <button
              className="btn btn-success"
              onClick={() => onViewReport(activeJob.id, jobVersionId || undefined)}
            >
              View Command Report →
            </button>
          )}
        </div>
      )}

      <div className="datasets-layout">
        {/* Left: Datasets List Sidebar */}
        <div className="datasets-sidebar">
          <div className="sidebar-header">
            <h3>Registered Datasets</h3>
            <span className="badge badge-primary">{datasets.length} Active</span>
          </div>
          {loading ? (
            <div style={{ padding: '1rem' }}>
              <div className="skeleton" style={{ height: '56px', marginBottom: '8px' }}></div>
              <div className="skeleton" style={{ height: '56px', marginBottom: '8px' }}></div>
              <div className="skeleton" style={{ height: '56px' }}></div>
            </div>
          ) : datasets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>No datasets registered yet.</p>
              <button className="btn btn-sm btn-primary" onClick={() => setShowCreateModal(true)}>
                + Register First Dataset
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>{selectedDataset.name}</h2>
                    <span className="badge badge-success">ACTIVE</span>
                  </div>
                  <p className="text-muted" style={{ marginTop: '0.3rem' }}>{selectedDataset.description || 'No description provided.'}</p>
                  <span className="dataset-id-tag">ID: {selectedDataset.id}</span>
                </div>
                <button className="btn btn-secondary" onClick={() => setShowUploadModal(true)}>
                  + Upload New Version
                </button>
              </div>

              {/* Version Comparison Selector */}
              {versions.length >= 2 && (
                <div style={{ backgroundColor: '#111827', padding: '1.25rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>Version Comparison & Drift Analysis</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Compare structural schema drift and distribution shifts between two versions.</p>
                    </div>
                    <span className="badge badge-primary">COMPARE MODE</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>BASE VERSION (V1)</label>
                      <select className="form-control" value={baseVersionId} onChange={(e) => setBaseVersionId(e.target.value)}>
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            v{v.version_number} - {v.original_filename} ({formatBytes(Number(v.file_size_bytes))})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, display: 'block', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>TARGET VERSION (V2)</label>
                      <select className="form-control" value={targetVersionId} onChange={(e) => setTargetVersionId(e.target.value)}>
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            v{v.version_number} - {v.original_filename} ({formatBytes(Number(v.file_size_bytes))})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ alignSelf: 'flex-end' }}>
                      <button className="btn btn-primary" onClick={handleCompareVersions} disabled={compareLoading}>
                        {compareLoading ? 'Computing Drift...' : '⚡ Compare Versions & Drift'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Comparison View with Stale Consistency Check */}
              {activeComparison && (() => {
                const isComparisonStale = Boolean(
                  activeComparison.base_version_id !== baseVersionId ||
                  activeComparison.target_version_id !== targetVersionId
                );
                const baseVer = versions.find(v => v.id === baseVersionId);
                const targetVer = versions.find(v => v.id === targetVersionId);
                const compBaseVer = versions.find(v => v.id === activeComparison.base_version_id);
                const compTargetVer = versions.find(v => v.id === activeComparison.target_version_id);

                return (
                  <div style={{ marginBottom: '2rem' }}>
                    {isComparisonStale && (
                      <div className="alert alert-warning" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                          <strong>⚠️ Stale Comparison View:</strong> Selected dropdowns (Base: {baseVer ? `v${baseVer.version_number}` : 'selected'}, Target: {targetVer ? `v${targetVer.version_number}` : 'selected'}) do not match the displayed comparison result below ({compBaseVer ? `v${compBaseVer.version_number}` : 'Base'} → {compTargetVer ? `v${compTargetVer.version_number}` : 'Target'}).
                        </div>
                        <button className="btn btn-sm btn-primary" onClick={handleCompareVersions} disabled={compareLoading}>
                          {compareLoading ? 'Updating...' : '⚡ Update Comparison for Selected'}
                        </button>
                      </div>
                    )}
                    <VersionComparisonView comparison={activeComparison} onClose={() => setActiveComparison(null)} />
                  </div>
                );
              })()}

              {/* Historical Quality Chart */}
              {history.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <HistoricalTrendChart history={history} />
                </div>
              )}

              {/* Version Table */}
              <div className="versions-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>Version History</h3>
                  <span className="badge badge-neutral">{versions.length} File Versions</span>
                </div>

                {loadingVersions ? (
                  <div style={{ padding: '1rem' }}>
                    <div className="skeleton" style={{ height: '40px', marginBottom: '8px' }}></div>
                    <div className="skeleton" style={{ height: '40px', marginBottom: '8px' }}></div>
                    <div className="skeleton" style={{ height: '40px' }}></div>
                  </div>
                ) : versions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem', backgroundColor: 'var(--bg-app)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No versions uploaded for this dataset yet.</p>
                    <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                      + Upload First Version (.csv, .parquet)
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
                            <td className="font-mono" style={{ fontWeight: 600, color: '#ffffff' }}>{ver.original_filename}</td>
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
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
              <p>Select a dataset from the sidebar to inspect its history, run analysis, or compare versions.</p>
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
                  <label>DATASET NAME *</label>
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
                  <label>DESCRIPTION</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Brief summary of dataset contents, source, or pipeline purpose"
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
                  {createLoading ? 'Registering...' : 'Create Dataset'}
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
                {uploadError && <div className="alert alert-error">⚠️ {uploadError}</div>}
                <div className="form-group">
                  <label>CHOOSE FILE (.csv or .parquet) *</label>
                  <input
                    type="file"
                    className="form-control"
                    accept=".csv,.parquet,.pq"
                    onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                    required
                  />
                  <small className="text-muted" style={{ display: 'block', marginTop: '0.35rem' }}>Maximum supported file size: 100 MB.</small>
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
                  {uploadLoading ? 'Uploading...' : 'Upload File Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

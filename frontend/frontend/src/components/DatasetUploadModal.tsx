import React, { useState } from 'react';
import { api } from '../services/api';
import { Dataset, DatasetVersion } from '../types';

interface DatasetUploadModalProps {
  dataset: Dataset;
  onClose: () => void;
  onSuccess: (version: DatasetVersion) => void;
}

export const DatasetUploadModal: React.FC<DatasetUploadModalProps> = ({
  dataset,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV or Parquet file.');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'parquet' && ext !== 'pq') {
      setError('Unsupported file type. Only .csv and .parquet files are allowed.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const version = await api.uploadDatasetVersion(dataset.id, file, (percent) => {
        setProgress(percent);
      });
      onSuccess(version);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to upload dataset version.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div className="modal-header">
          <h3>Upload Version for {dataset.name}</h3>
          <button className="modal-close" onClick={onClose} disabled={uploading}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label>Choose File (.csv, .parquet) *</label>
              <input
                type="file"
                className="form-control"
                accept=".csv,.parquet,.pq"
                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                disabled={uploading}
                required
              />
              <small className="text-muted">Maximum allowed upload size: 100 MB.</small>
            </div>
            {uploading && (
              <div className="progress-container">
                <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                <span className="progress-text">{progress}% Uploaded</span>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || !file}
            >
              {uploading ? 'Uploading...' : 'Upload Version'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import axios from 'axios';
import {
  Dataset,
  DatasetVersion,
  AnalysisJob,
  AnalysisResult,
  VersionComparison,
  QualityHistoryItem,
  AIInterpretation,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Health & Readiness
  async getHealth(): Promise<{ status: string }> {
    const res = await apiClient.get('/health');
    return res.data;
  },

  async getReady(): Promise<{ status: string; dependencies: { postgres: string; redis: string } }> {
    const res = await apiClient.get('/ready');
    return res.data;
  },

  // Datasets
  async listDatasets(): Promise<Dataset[]> {
    const res = await apiClient.get('/v1/datasets');
    return res.data.datasets || [];
  },

  async getDataset(id: string): Promise<{ dataset: Dataset; versions: DatasetVersion[] }> {
    const res = await apiClient.get(`/v1/datasets/${id}`);
    return res.data;
  },

  async createDataset(name: string, description?: string): Promise<Dataset> {
    const res = await apiClient.post('/v1/datasets', { name, description });
    return res.data.dataset;
  },

  async uploadDatasetVersion(
    datasetId: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<DatasetVersion> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await apiClient.post(`/v1/datasets/${datasetId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });

    return res.data.version;
  },

  // Analysis
  async runAnalysis(versionId: string): Promise<{ job_id: string; job_status: string }> {
    const res = await apiClient.post('/v1/analysis/run', { version_id: versionId });
    return res.data;
  },

  async getJobStatus(jobId: string): Promise<AnalysisJob> {
    const res = await apiClient.get(`/v1/analysis/status/${jobId}`);
    return res.data.job;
  },

  async getAnalysisResults(jobId: string): Promise<AnalysisResult> {
    const res = await apiClient.get(`/v1/analysis/results/${jobId}`);
    return res.data.result;
  },

  async getVersionAnalysis(versionId: string): Promise<AnalysisResult> {
    const res = await apiClient.get(`/v1/analysis/versions/${versionId}/analysis`);
    return res.data.result;
  },

  // Phase 3.2 Comparison & History
  async compareVersions(
    datasetId: string,
    baseVersionId: string,
    targetVersionId: string
  ): Promise<VersionComparison> {
    const res = await apiClient.post(`/v1/datasets/${datasetId}/compare`, {
      base_version_id: baseVersionId,
      target_version_id: targetVersionId,
    });
    return res.data.comparison;
  },

  async getComparison(comparisonId: string): Promise<VersionComparison> {
    const res = await apiClient.get(`/v1/datasets/comparisons/${comparisonId}`);
    return res.data.comparison;
  },

  async getDatasetHistory(datasetId: string): Promise<QualityHistoryItem[]> {
    const res = await apiClient.get(`/v1/datasets/${datasetId}/history`);
    return res.data.history || [];
  },

  // Phase 3.3 AI Interpretation
  async getAIInterpretation(datasetId: string, versionId?: string): Promise<AIInterpretation> {
    const res = await apiClient.post(`/v1/datasets/${datasetId}/ai-interpretation`, {
      version_id: versionId,
    });
    return res.data.interpretation;
  },
};


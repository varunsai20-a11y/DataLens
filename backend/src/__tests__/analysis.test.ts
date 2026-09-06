import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../app';
import { pool } from '../services/db';
import { redisClient } from '../services/redis';
import { runMigrations } from '../db/migrator';
import { analysisService } from '../services/analysisService';

jest.mock('../services/queueService', () => ({
  analysisQueue: { add: jest.fn(), getJob: jest.fn() },
  enqueueAnalysisJob: jest.fn().mockResolvedValue(undefined),
  reconcileOrphanedJobs: jest.fn().mockResolvedValue(undefined),
}));

describe('Checkpoint 2: Analysis Backend and Job Lifecycle Tests', () => {
  let datasetId: string;
  let versionId: string;
  let jobId: string;
  const testCsvPath = path.join(__dirname, 'test_analysis_sample.csv');

  const mockReport = {
    analysis_version: '1.0.0',
    summary: {
      row_count: 50,
      column_count: 3,
      duplicate_row_count: 0,
      duplicate_row_percentage: 0.0,
      total_cells: 150,
      total_missing_cells: 0,
      total_missing_percentage: 0.0,
      memory_usage_bytes: 4096,
    },
    columns: [
      {
        name: 'id',
        dtype: 'int64',
        inferred_type: 'integer',
        total_count: 50,
        missing_count: 0,
        missing_percentage: 0.0,
        unique_count: 50,
        uniqueness_percentage: 100.0,
        min: 1,
        max: 50,
        mean: 25.5,
        median: 25.5,
      },
    ],
    quality_issues: [],
    outliers: [],
    score: {
      overall: 98.5,
      dimensions: {
        completeness: 100.0,
        validity: 100.0,
        uniqueness: 100.0,
        consistency: 100.0,
        outlier_quality: 90.0,
      },
      grade: 'A',
    },
    recommendations: [
      {
        category: 'HEALTH',
        priority: 'LOW',
        message: 'Dataset structure is clean.',
        suggestion: 'Proceed with analytical workloads.',
      },
    ],
  };

  beforeAll(async () => {
    await runMigrations();

    // Create a sample CSV
    fs.writeFileSync(testCsvPath, 'id,name,salary\n1,Alice,50000\n2,Bob,60000\n');

    // Create a dataset
    const dsRes = await request(app)
      .post('/api/v1/datasets')
      .send({ name: 'Analysis Test Dataset' });
    datasetId = dsRes.body.dataset.id;

    // Upload a version
    const verRes = await request(app)
      .post(`/api/v1/datasets/${datasetId}/upload`)
      .attach('file', testCsvPath);
    versionId = verRes.body.version.id;
  });

  afterAll(async () => {
    if (fs.existsSync(testCsvPath)) fs.unlinkSync(testCsvPath);
    await pool.end();
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  });

  test('POST /api/v1/analysis/run should reject missing version_id', async () => {
    const res = await request(app).post('/api/v1/analysis/run').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_INPUT');
  });

  test('POST /api/v1/analysis/run should reject non-existent version_id', async () => {
    const res = await request(app)
      .post('/api/v1/analysis/run')
      .send({ version_id: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });

  test('POST /api/v1/analysis/run should create an analysis job in PENDING status', async () => {
    // Mock triggerEngineAnalysis to prevent external HTTP failure during unit test
    const spy = jest.spyOn(analysisService, 'triggerEngineAnalysis').mockImplementation(async () => {});

    const res = await request(app)
      .post('/api/v1/analysis/run')
      .send({ version_id: versionId });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body).toHaveProperty('job_id');
    expect(res.body.job_status).toBe('PENDING');

    jobId = res.body.job_id;
    spy.mockRestore();
  });

  test('GET /api/v1/analysis/status/:job_id should return job status', async () => {
    const res = await request(app).get(`/api/v1/analysis/status/${jobId}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.job.id).toBe(jobId);
    expect(res.body.job.status).toBe('PENDING');
  });

  test('GET /api/v1/analysis/results/:job_id should return 202 while job is pending/processing', async () => {
    const res = await request(app).get(`/api/v1/analysis/results/${jobId}`);
    expect(res.status).toBe(202);
    expect(res.body.status).toBe('PENDING');
  });

  test('POST /api/v1/engine/callback should process completed results and update job', async () => {
    const res = await request(app)
      .post('/api/v1/engine/callback')
      .send({
        job_id: jobId,
        status: 'COMPLETED',
        results: mockReport,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACKNOWLEDGED');

    // Verify job is now COMPLETED
    const statusRes = await request(app).get(`/api/v1/analysis/status/${jobId}`);
    expect(statusRes.body.job.status).toBe('COMPLETED');
  });

  test('POST /api/v1/engine/callback should be idempotent for duplicate calls', async () => {
    const res = await request(app)
      .post('/api/v1/engine/callback')
      .send({
        job_id: jobId,
        status: 'COMPLETED',
        results: mockReport,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACKNOWLEDGED');
  });

  test('GET /api/v1/analysis/results/:job_id should return full stored analysis report', async () => {
    const res = await request(app).get(`/api/v1/analysis/results/${jobId}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.result).toHaveProperty('overall_quality_score');
    expect(Number(res.body.result.overall_quality_score)).toBe(98.5);
    expect(res.body.result.summary.row_count).toBe(50);
    expect(Array.isArray(res.body.result.recommendations)).toBe(true);
  });

  test('GET /api/v1/dataset-versions/:versionId/analysis should return latest analysis', async () => {
    const res = await request(app).get(`/api/v1/dataset-versions/${versionId}/analysis`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.result.job_id).toBe(jobId);
  });

  test('POST /api/v1/engine/callback should record job failures', async () => {
    const spy = jest.spyOn(analysisService, 'triggerEngineAnalysis').mockImplementation(async () => {});

    // Create a new job to fail
    const jobRes = await request(app)
      .post('/api/v1/analysis/run')
      .send({ version_id: versionId });
    const failJobId = jobRes.body.job_id;

    const res = await request(app)
      .post('/api/v1/engine/callback')
      .send({
        job_id: failJobId,
        status: 'FAILED',
        error: 'Corrupted CSV structure at line 4',
      });

    expect(res.status).toBe(200);

    const statusRes = await request(app).get(`/api/v1/analysis/status/${failJobId}`);
    expect(statusRes.body.job.status).toBe('FAILED');
    expect(statusRes.body.job.error_message).toBe('Corrupted CSV structure at line 4');

    spy.mockRestore();
  });
});

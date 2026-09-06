import { pool } from '../services/db';
import { runMigrations } from '../db/migrator';
import { analysisService } from '../services/analysisService';

describe('Phase 3.1 Queue & Worker Lifecycle Unit Tests', () => {
  let versionId: string;
  let datasetId: string;

  beforeAll(async () => {
    await runMigrations();

    // Create a mock dataset and dataset version directly in DB
    const dsRes = await pool.query(
      `INSERT INTO datasets (name, description) VALUES ('Queue Unit Dataset', 'Test') RETURNING id`
    );
    datasetId = dsRes.rows[0].id;

    const verRes = await pool.query(
      `INSERT INTO dataset_versions (dataset_id, version_number, original_filename, stored_filename, storage_path, checksum, file_size_bytes)
       VALUES ($1, 1, 'test.csv', 'test.csv', '/app/storage/test.csv', 'dummy', 100)
       RETURNING id`,
      [datasetId]
    );
    versionId = verRes.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM datasets WHERE id = $1`, [datasetId]);
    await pool.end();
  });

  test('handleJobSuccess should idempotently save analysis results', async () => {
    const jobRes = await pool.query(
      `INSERT INTO analysis_jobs (dataset_version_id, status) VALUES ($1, 'PROCESSING') RETURNING id`,
      [versionId]
    );
    const jobId = jobRes.rows[0].id;

    const report = {
      analysis_version: '1.0.0',
      score: { overall: 95.0, dimensions: { completeness: 100, validity: 90 } },
      summary: { row_count: 10, column_count: 2 },
      columns: [],
      quality_issues: [],
      outliers: [],
      recommendations: [],
    };

    // First call
    const res1 = await analysisService.handleJobSuccess(jobId, report);
    expect(res1).toHaveProperty('id');

    // Duplicate call (idempotency check)
    const res2 = await analysisService.handleJobSuccess(jobId, report);
    expect(res2.id).toBe(res1.id);

    // Verify DB state
    const jobStatus = await analysisService.getJobStatus(jobId);
    expect(jobStatus?.status).toBe('COMPLETED');
  });

  test('handleJobFailure should update job status to FAILED with error message', async () => {
    const jobRes = await pool.query(
      `INSERT INTO analysis_jobs (dataset_version_id, status) VALUES ($1, 'PROCESSING') RETURNING id`,
      [versionId]
    );
    const jobId = jobRes.rows[0].id;

    await analysisService.handleJobFailure(jobId, 'Simulated engine failure');

    const jobStatus = await analysisService.getJobStatus(jobId);
    expect(jobStatus?.status).toBe('FAILED');
    expect(jobStatus?.error_message).toBe('Simulated engine failure');
  });
});

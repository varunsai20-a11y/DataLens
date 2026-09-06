import request from 'supertest';
import app from '../app';
import { pool } from '../services/db';
import { runMigrations } from '../db/migrator';
import { authService } from '../services/authService';

jest.mock('../services/queueService', () => ({
  analysisQueue: { add: jest.fn(), getJob: jest.fn() },
  enqueueAnalysisJob: jest.fn().mockResolvedValue(undefined),
  reconcileOrphanedJobs: jest.fn().mockResolvedValue(undefined),
}));

describe('Phase 3.2 Comparison & History API Tests', () => {
  let datasetId: string;
  let v1Id: string;
  let v2Id: string;
  let testToken: string;

  beforeAll(async () => {
    await runMigrations();

    testToken = authService.generateToken({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'demo@datalens.internal',
      name: 'System Demo Account',
      role: 'USER',
      is_system: true,
      created_at: new Date().toISOString(),
    });

    // 1. Create dataset
    const dsRes = await pool.query(
      `INSERT INTO datasets (name, description, user_id) VALUES ('Phase 3.2 Comparison Dataset', 'Test', '00000000-0000-0000-0000-000000000001') RETURNING id`
    );
    datasetId = dsRes.rows[0].id;

    // 2. Create version 1 and completed analysis
    const v1Res = await pool.query(
      `INSERT INTO dataset_versions (dataset_id, version_number, original_filename, stored_filename, storage_path, checksum, file_size_bytes)
       VALUES ($1, 1, 'v1.csv', 'v1.csv', '/app/storage/v1.csv', 'hash1', 100) RETURNING id`,
      [datasetId]
    );
    v1Id = v1Res.rows[0].id;

    const j1Res = await pool.query(
      `INSERT INTO analysis_jobs (dataset_version_id, status) VALUES ($1, 'COMPLETED') RETURNING id`,
      [v1Id]
    );
    const j1Id = j1Res.rows[0].id;

    await pool.query(
      `INSERT INTO analysis_results (job_id, dataset_version_id, analysis_version, overall_quality_score, dimensions, summary, profiling, quality_checks, outliers, recommendations)
       VALUES ($1, $2, '1.0.0', 95.0, '{}', '{"row_count": 100, "column_count": 5}', '[]', '[]', '[]', '[]')`,
      [j1Id, v1Id]
    );

    // 3. Create version 2 and completed analysis
    const v2Res = await pool.query(
      `INSERT INTO dataset_versions (dataset_id, version_number, original_filename, stored_filename, storage_path, checksum, file_size_bytes)
       VALUES ($1, 2, 'v2.csv', 'v2.csv', '/app/storage/v2.csv', 'hash2', 100) RETURNING id`,
      [datasetId]
    );
    v2Id = v2Res.rows[0].id;

    const j2Res = await pool.query(
      `INSERT INTO analysis_jobs (dataset_version_id, status) VALUES ($1, 'COMPLETED') RETURNING id`,
      [v2Id]
    );
    const j2Id = j2Res.rows[0].id;

    await pool.query(
      `INSERT INTO analysis_results (job_id, dataset_version_id, analysis_version, overall_quality_score, dimensions, summary, profiling, quality_checks, outliers, recommendations)
       VALUES ($1, $2, '1.0.0', 82.5, '{}', '{"row_count": 120, "column_count": 5}', '[]', '[]', '[]', '[]')`,
      [j2Id, v2Id]
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM datasets WHERE id = $1`, [datasetId]);
    await pool.end();
  });

  test('GET /api/v1/datasets/:id/history should return dataset quality timeline', async () => {
    const res = await request(app)
      .get(`/api/v1/datasets/${datasetId}/history`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
    expect(Array.isArray(res.body.history)).toBe(true);
    expect(res.body.history.length).toBe(2);
    expect(res.body.history[0].version_number).toBe(1);
    expect(res.body.history[0].overall_quality_score).toBe(95.0);
    expect(res.body.history[0].combined_health_score).toBe(95.0);
    expect(res.body.history[0].health_status).toBe('HEALTHY');
    expect(res.body.history[1].version_number).toBe(2);
    expect(res.body.history[1].overall_quality_score).toBe(82.5);
    expect(res.body.history[1].health_status).toBeDefined();
  });

  test('POST /api/v1/datasets/:id/compare should reject identical versions', async () => {
    const res = await request(app)
      .post(`/api/v1/datasets/${datasetId}/compare`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ base_version_id: v1Id, target_version_id: v1Id });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_INPUT');
  });

  test('POST /api/v1/datasets/:id/compare should reject missing versions', async () => {
    const res = await request(app)
      .post(`/api/v1/datasets/${datasetId}/compare`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ base_version_id: v1Id });

    expect(res.status).toBe(400);
  });
});

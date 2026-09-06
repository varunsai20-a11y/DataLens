import path from 'path';
import fs from 'fs';

// Ensure storage path is accessible on Windows before app imports
const testStorageDir = path.join(__dirname, 'test_storage');
if (!fs.existsSync(testStorageDir)) {
  fs.mkdirSync(testStorageDir, { recursive: true });
}
process.env.STORAGE_PATH = testStorageDir;

import request from 'supertest';
import app from '../app';
import { pool } from '../services/db';
import { authService } from '../services/authService';
import { analysisService } from '../services/analysisService';
import { v4 as uuidv4 } from 'uuid';

jest.mock('../services/queueService', () => ({
  analysisQueue: { add: jest.fn(), getJob: jest.fn() },
  enqueueAnalysisJob: jest.fn().mockResolvedValue(undefined),
  reconcileOrphanedJobs: jest.fn().mockResolvedValue(undefined),
}));

describe('Phase 4.2 Dataset Ownership & Multi-Tenant Access Control Tests', () => {
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;

  let datasetAId: string;
  let datasetBId: string;
  let versionA1Id: string;
  let versionA2Id: string;
  let versionB1Id: string;
  let jobA1Id: string;
  let jobA2Id: string;
  let jobB1Id: string;

  const testCsvPath = path.join(__dirname, 'test_ownership_sample.csv');

  // In-memory mock DB state
  const dbUsers = new Map<string, any>();
  const dbDatasets = new Map<string, any>();
  const dbVersions = new Map<string, any>();
  const dbJobs = new Map<string, any>();
  const dbResults = new Map<string, any>();
  const dbComparisons = new Map<string, any>();

  const mockReport = {
    analysis_version: '1.0.0',
    summary: { row_count: 25, column_count: 2, total_missing_percentage: 0 },
    columns: [{ name: 'id', dtype: 'int64', min: 1, max: 25 }],
    quality_issues: [],
    outliers: [],
    score: { overall: 96.0, dimensions: { completeness: 100.0 } },
    recommendations: [],
  };

  const handleQuery = async (sql: string, params?: any[]) => {
    const q = sql.trim().replace(/\s+/g, ' ').toUpperCase();

    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(q)) {
      return { rows: [], rowCount: 0 };
    }

    // SELECT FOR UPDATE / CHECK DATASET OWNERSHIP
    if (q.includes('SELECT') && q.includes('FROM DATASETS') && q.includes('WHERE ID = $1 AND USER_ID = $2')) {
      const ds = dbDatasets.get(params![0]);
      if (ds && ds.user_id === params![1]) return { rows: [ds], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }

    if (q.includes('SELECT') && q.includes('FROM DATASETS') && (q.includes('WHERE ID = $1') || q.includes('WHERE ID = $1 FOR UPDATE'))) {
      const ds = dbDatasets.get(params![0]);
      if (!ds) return { rows: [], rowCount: 0 };
      return { rows: [ds], rowCount: 1 };
    }

    if (q.includes('SELECT D.ID, D.NAME') && q.includes('FROM DATASETS D') && q.includes('WHERE D.USER_ID = $1')) {
      const userDs = Array.from(dbDatasets.values()).filter((d) => d.user_id === params![0]);
      return { rows: userDs, rowCount: userDs.length };
    }

    if (q.includes('SELECT D.ID, D.NAME') && q.includes('FROM DATASETS D')) {
      const allDs = Array.from(dbDatasets.values());
      return { rows: allDs, rowCount: allDs.length };
    }

    // INSERT DATASETS
    if (q.startsWith('INSERT INTO DATASETS')) {
      const id = uuidv4();
      const ds = {
        id,
        name: params![0],
        description: params![1],
        user_id: params![2],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      dbDatasets.set(id, ds);
      return { rows: [ds], rowCount: 1 };
    }

    // DELETE DATASETS
    if (q.startsWith('DELETE FROM DATASETS')) {
      const id = params![0];
      const userId = params![1];
      const ds = dbDatasets.get(id);
      if (ds && (!userId || ds.user_id === userId)) {
        dbDatasets.delete(id);
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // UPDATE DATASETS
    if (q.startsWith('UPDATE DATASETS')) {
      const id = params![0];
      const ds = dbDatasets.get(id);
      if (ds) {
        ds.updated_at = new Date().toISOString();
        return { rows: [ds], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // INSERT DATASET_VERSIONS
    if (q.startsWith('INSERT INTO DATASET_VERSIONS')) {
      const id = uuidv4();
      const verNum = params![1];
      const ver = {
        id,
        dataset_id: params![0],
        version_number: verNum,
        original_filename: params![2],
        stored_filename: params![3],
        storage_path: params![4],
        checksum: params![5],
        file_size_bytes: params![6],
        mime_type: params![7],
        created_at: new Date().toISOString(),
      };
      dbVersions.set(id, ver);
      return { rows: [ver], rowCount: 1 };
    }

    // SELECT DATASET_VERSIONS
    if (q.includes('MAX(VERSION_NUMBER)')) {
      const vers = Array.from(dbVersions.values()).filter((v) => v.dataset_id === params![0]);
      const maxVer = vers.reduce((max, v) => Math.max(max, v.version_number), 0);
      return { rows: [{ next_ver: maxVer + 1 }], rowCount: 1 };
    }

    if (q.includes('FROM DATASET_VERSIONS') && q.includes('WHERE DATASET_ID = $1')) {
      const vers = Array.from(dbVersions.values()).filter((v) => v.dataset_id === params![0]);
      return { rows: vers, rowCount: vers.length };
    }

    if (q.includes('FROM DATASET_VERSIONS') && q.includes('WHERE ID = $1')) {
      const ver = dbVersions.get(params![0]);
      return { rows: ver ? [ver] : [], rowCount: ver ? 1 : 0 };
    }

    // INSERT ANALYSIS_JOBS
    if (q.startsWith('INSERT INTO ANALYSIS_JOBS')) {
      const id = uuidv4();
      const job = {
        id,
        dataset_version_id: params![0],
        status: 'PENDING',
        error_message: null,
        started_at: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      dbJobs.set(id, job);
      return { rows: [job], rowCount: 1 };
    }

    if (q.includes('FROM ANALYSIS_JOBS J') && q.includes('JOIN DATASET_VERSIONS V')) {
      const job = dbJobs.get(params![0]);
      if (job) {
        const ver = dbVersions.get(job.dataset_version_id);
        if (ver) return { rows: [{ dataset_id: ver.dataset_id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (q.includes('FROM ANALYSIS_JOBS') && q.includes('WHERE ID = $1')) {
      const job = dbJobs.get(params![0]);
      return { rows: job ? [job] : [], rowCount: job ? 1 : 0 };
    }

    if (q.startsWith('UPDATE ANALYSIS_JOBS')) {
      const jobId = params![params!.length - 1];
      const job = dbJobs.get(jobId);
      if (job) {
        if (sql.includes('COMPLETED')) job.status = 'COMPLETED';
        if (sql.includes('FAILED')) job.status = 'FAILED';
        return { rows: [job], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // INSERT / SELECT ANALYSIS_RESULTS
    if (q.startsWith('INSERT INTO ANALYSIS_RESULTS')) {
      const id = uuidv4();
      const resRec = {
        id,
        job_id: params![0],
        dataset_version_id: params![1],
        analysis_version: params![2],
        overall_quality_score: params![3],
        dimensions: params![4],
        summary: params![5],
        profiling: params![6],
        quality_checks: params![7],
        outliers: params![8],
        recommendations: params![9],
        created_at: new Date().toISOString(),
      };
      dbResults.set(id, resRec);
      return { rows: [resRec], rowCount: 1 };
    }

    if (q.includes('FROM ANALYSIS_RESULTS') && q.includes('WHERE JOB_ID = $1')) {
      const resRec = Array.from(dbResults.values()).find((r) => r.job_id === params![0]);
      return { rows: resRec ? [resRec] : [], rowCount: resRec ? 1 : 0 };
    }

    if (q.includes('FROM ANALYSIS_RESULTS') && q.includes('WHERE DATASET_VERSION_ID = $1')) {
      const resRec = Array.from(dbResults.values()).find((r) => r.dataset_version_id === params![0]);
      return { rows: resRec ? [resRec] : [], rowCount: resRec ? 1 : 0 };
    }

    if (q.startsWith('UPDATE ANALYSIS_RESULTS')) {
      return { rows: [], rowCount: 1 };
    }

    // VERSION COMPARISONS
    if (q.includes('FROM VERSION_COMPARISONS') && q.includes('WHERE ID = $1')) {
      const comp = dbComparisons.get(params![0]);
      return { rows: comp ? [comp] : [], rowCount: comp ? 1 : 0 };
    }

    if (q.includes('SELECT ID, USER_ID FROM DATASETS WHERE ID IN ($1, $2)')) {
      const rows = [];
      const ds1 = dbDatasets.get(params![0]);
      const ds2 = dbDatasets.get(params![1]);
      if (ds1) rows.push(ds1);
      if (ds2) rows.push(ds2);
      return { rows, rowCount: rows.length };
    }

    if (q.startsWith('INSERT INTO VERSION_COMPARISONS')) {
      const id = uuidv4();
      const comp = {
        id,
        dataset_id: params![0],
        base_version_id: params![1],
        target_version_id: params![2],
        comparison_result: params![3],
        score_delta: params![4],
        created_at: new Date().toISOString(),
      };
      dbComparisons.set(id, comp);
      return { rows: [comp], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  };

  beforeAll(() => {
    fs.writeFileSync(testCsvPath, 'id,val\n1,10\n2,20\n');

    userAId = uuidv4();
    userBId = uuidv4();

    const userA = {
      id: userAId,
      email: 'usera@example.com',
      password_hash: '$2a$12$hashA',
      name: 'User A',
      role: 'USER',
      is_system: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const userB = {
      id: userBId,
      email: 'userb@example.com',
      password_hash: '$2a$12$hashB',
      name: 'User B',
      role: 'USER',
      is_system: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    dbUsers.set(userA.email, userA);
    dbUsers.set(userB.email, userB);

    userAToken = authService.generateToken({
      id: userA.id,
      email: userA.email,
      name: userA.name,
      role: 'USER',
      is_system: false,
      created_at: userA.created_at,
    });

    userBToken = authService.generateToken({
      id: userB.id,
      email: userB.email,
      name: userB.name,
      role: 'USER',
      is_system: false,
      created_at: userB.created_at,
    });

    const mockClient = {
      query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => handleQuery(sql, params)),
      release: jest.fn(),
    };

    (jest.spyOn(pool, 'connect') as jest.Mock).mockResolvedValue(mockClient);
    (jest.spyOn(pool, 'query') as jest.Mock).mockImplementation(async (sql: string, params?: any[]) => handleQuery(sql, params));
  });

  afterAll(async () => {
    if (fs.existsSync(testCsvPath)) fs.unlinkSync(testCsvPath);
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    (pool.query as jest.Mock).mockRestore();
    (pool.connect as jest.Mock).mockRestore();
  });

  describe('1. Authentication Enforcement', () => {
    test('Unauthenticated request to GET /api/v1/datasets should return 401', async () => {
      const res = await request(app).get('/api/v1/datasets');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    test('Invalid Bearer token should return 401', async () => {
      const res = await request(app)
        .get('/api/v1/datasets')
        .set('Authorization', 'Bearer invalid.jwt.token');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Dataset Creation & Ownership Assignment', () => {
    test('User A creating a dataset assigns user_id to User A', async () => {
      const res = await request(app)
        .post('/api/v1/datasets')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          name: "User A's Financial Dataset",
          description: "Private Q3 financial records",
          user_id: userBId, // Attempt to spoof user_id
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('SUCCESS');
      expect(res.body.dataset.id).toBeDefined();
      expect(res.body.dataset.user_id).toBe(userAId); // Must be User A, not spoofed User B
      datasetAId = res.body.dataset.id;
    });

    test('User B creating a dataset assigns user_id to User B', async () => {
      const res = await request(app)
        .post('/api/v1/datasets')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          name: "User B's Healthcare Dataset",
          description: "Patient telemetry logs",
        });

      expect(res.status).toBe(201);
      expect(res.body.dataset.user_id).toBe(userBId);
      datasetBId = res.body.dataset.id;
    });
  });

  describe('3. Multi-Tenant Dataset Access & Version Upload', () => {
    test("User A can upload version to User A's dataset", async () => {
      const res = await request(app)
        .post(`/api/v1/datasets/${datasetAId}/upload`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', testCsvPath);

      expect(res.status).toBe(201);
      expect(res.body.version.dataset_id).toBe(datasetAId);
      versionA1Id = res.body.version.id;
    });

    test("User A can upload second version to User A's dataset", async () => {
      const res = await request(app)
        .post(`/api/v1/datasets/${datasetAId}/upload`)
        .set('Authorization', `Bearer ${userAToken}`)
        .attach('file', testCsvPath);

      expect(res.status).toBe(201);
      expect(res.body.version.version_number).toBe(2);
      versionA2Id = res.body.version.id;
    });

    test("User B can upload version to User B's dataset", async () => {
      const res = await request(app)
        .post(`/api/v1/datasets/${datasetBId}/upload`)
        .set('Authorization', `Bearer ${userBToken}`)
        .attach('file', testCsvPath);

      expect(res.status).toBe(201);
      versionB1Id = res.body.version.id;
    });

    test("User B CANNOT upload version to User A's dataset (403)", async () => {
      const res = await request(app)
        .post(`/api/v1/datasets/${datasetAId}/upload`)
        .set('Authorization', `Bearer ${userBToken}`)
        .attach('file', testCsvPath);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    test("User B CANNOT view User A's dataset details (403)", async () => {
      const res = await request(app)
        .get(`/api/v1/datasets/${datasetAId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    test("User A listing datasets only returns User A's datasets", async () => {
      const res = await request(app)
        .get('/api/v1/datasets')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.datasets)).toBe(true);
      const datasetIds = res.body.datasets.map((d: any) => d.id);
      expect(datasetIds).toContain(datasetAId);
      expect(datasetIds).not.toContain(datasetBId);
    });
  });

  describe('4. Analysis Authorization & Job Enqueuing', () => {
    test("User A can enqueue analysis for User A's dataset version", async () => {
      const spy = jest.spyOn(analysisService, 'triggerEngineAnalysis').mockImplementation(async () => {});

      const res = await request(app)
        .post('/api/v1/analysis/run')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ version_id: versionA1Id });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('SUCCESS');
      jobA1Id = res.body.job_id;

      spy.mockRestore();
    });

    test("User B CANNOT enqueue analysis for User A's dataset version (403)", async () => {
      const res = await request(app)
        .post('/api/v1/analysis/run')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ version_id: versionA1Id });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    test("User B CANNOT view job status for User A's analysis job (403)", async () => {
      const res = await request(app)
        .get(`/api/v1/analysis/status/${jobA1Id}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    test("User A can view job status for User A's analysis job", async () => {
      const res = await request(app)
        .get(`/api/v1/analysis/status/${jobA1Id}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.job.id).toBe(jobA1Id);
    });
  });

  describe('5. Comparison & Drift Authorization', () => {
    beforeAll(async () => {
      // Complete analysis job for versionA1
      await request(app)
        .post('/api/v1/engine/callback')
        .send({ job_id: jobA1Id, status: 'COMPLETED', results: mockReport });

      // Run & complete analysis for versionA2
      const spy = jest.spyOn(analysisService, 'triggerEngineAnalysis').mockImplementation(async () => {});
      const jobA2Res = await request(app)
        .post('/api/v1/analysis/run')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ version_id: versionA2Id });
      jobA2Id = jobA2Res.body.job_id;

      await request(app)
        .post('/api/v1/engine/callback')
        .send({ job_id: jobA2Id, status: 'COMPLETED', results: mockReport });

      // Run & complete analysis for versionB1
      const jobB1Res = await request(app)
        .post('/api/v1/analysis/run')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ version_id: versionB1Id });
      jobB1Id = jobB1Res.body.job_id;

      await request(app)
        .post('/api/v1/engine/callback')
        .send({ job_id: jobB1Id, status: 'COMPLETED', results: mockReport });

      spy.mockRestore();
    });

    test("User B CANNOT run comparison on User A's dataset (403)", async () => {
      const res = await request(app)
        .post(`/api/v1/datasets/${datasetAId}/compare`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          base_version_id: versionA1Id,
          target_version_id: versionA2Id,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    test("User B CANNOT perform cross-tenant comparison of User A base vs User B target (403)", async () => {
      const res = await request(app)
        .post(`/api/v1/datasets/${datasetBId}/compare`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          base_version_id: versionA1Id, // User A's version
          target_version_id: versionB1Id, // User B's version
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });
  });

  describe('6. AI Interpretation Authorization', () => {
    test("User A can request AI interpretation for User A's dataset", async () => {
      const res = await request(app)
        .post(`/api/v1/datasets/${datasetAId}/ai-interpretation`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ version_id: versionA1Id });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      expect(res.body.interpretation).toHaveProperty('summary');
    });

    test("User B CANNOT request AI interpretation for User A's dataset (403)", async () => {
      const res = await request(app)
        .post(`/api/v1/datasets/${datasetAId}/ai-interpretation`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ version_id: versionA1Id });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });
  });

  describe('7. Dataset Deletion Authorization', () => {
    test("User B CANNOT delete User A's dataset (403)", async () => {
      const res = await request(app)
        .delete(`/api/v1/datasets/${datasetAId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    test("User A CAN delete User A's dataset (200)", async () => {
      const res = await request(app)
        .delete(`/api/v1/datasets/${datasetAId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');

      // Confirm dataset is gone for User A
      const checkRes = await request(app)
        .get(`/api/v1/datasets/${datasetAId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(checkRes.status).toBe(404);
    });
  });
});

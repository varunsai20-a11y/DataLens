import path from 'path';
import fs from 'fs';

// Ensure storage path exists before app imports
const testStorageDir = path.join(__dirname, 'test_security_storage');
if (!fs.existsSync(testStorageDir)) {
  fs.mkdirSync(testStorageDir, { recursive: true });
}
process.env.STORAGE_PATH = testStorageDir;

import request from 'supertest';
import express from 'express';
import app from '../app';
import { pool } from '../services/db';
import { authService } from '../services/authService';
import { createRateLimiter } from '../middleware/rateLimiter';
import { v4 as uuidv4 } from 'uuid';

jest.mock('../services/queueService', () => ({
  analysisQueue: { add: jest.fn(), getJob: jest.fn() },
  enqueueAnalysisJob: jest.fn().mockResolvedValue(undefined),
  reconcileOrphanedJobs: jest.fn().mockResolvedValue(undefined),
}));

describe('Phase 4.3 API Input Security & Rate Limiting Tests', () => {
  let validUserToken: string;
  let validUserId: string;
  let validDatasetId: string;
  let validVersionId: string;

  const dbDatasets = new Map<string, any>();
  const dbVersions = new Map<string, any>();

  const handleQuery = async (sql: string, params?: any[]) => {
    const q = sql.trim().replace(/\s+/g, ' ').toUpperCase();

    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(q)) {
      return { rows: [], rowCount: 0 };
    }

    if (q.includes('SELECT') && q.includes('FROM DATASETS') && (q.includes('WHERE ID = $1') || q.includes('WHERE ID = $1 FOR UPDATE'))) {
      const ds = dbDatasets.get(params![0]);
      if (!ds) return { rows: [], rowCount: 0 };
      return { rows: [ds], rowCount: 1 };
    }

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

    if (q.includes('SELECT') && q.includes('FROM DATASET_VERSIONS') && q.includes('WHERE ID = $1')) {
      const ver = dbVersions.get(params![0]);
      return { rows: ver ? [ver] : [], rowCount: ver ? 1 : 0 };
    }

    return { rows: [], rowCount: 0 };
  };

  beforeAll(() => {
    validUserId = uuidv4();
    validDatasetId = uuidv4();
    validVersionId = uuidv4();

    dbDatasets.set(validDatasetId, {
      id: validDatasetId,
      name: 'Valid Dataset',
      description: 'Description',
      user_id: validUserId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    dbVersions.set(validVersionId, {
      id: validVersionId,
      dataset_id: validDatasetId,
      version_number: 1,
      original_filename: 'sample.csv',
      stored_filename: 'stored.csv',
      storage_path: path.join(testStorageDir, 'sample.csv'),
      checksum: 'abc',
      file_size_bytes: 100,
      mime_type: 'text/csv',
      created_at: new Date().toISOString(),
    });

    validUserToken = authService.generateToken({
      id: validUserId,
      email: 'securitytest@datalens.internal',
      name: 'Security Tester',
      role: 'USER',
      is_system: false,
      created_at: new Date().toISOString(),
    });

    const mockClient = {
      query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => handleQuery(sql, params)),
      release: jest.fn(),
    };

    (jest.spyOn(pool, 'connect') as jest.Mock).mockResolvedValue(mockClient);
    (jest.spyOn(pool, 'query') as jest.Mock).mockImplementation(async (sql: string, params?: any[]) => handleQuery(sql, params));
  });

  afterAll(async () => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    (pool.query as jest.Mock).mockRestore();
    (pool.connect as jest.Mock).mockRestore();
  });

  describe('1. Authentication Endpoint Input Validation', () => {
    test('POST /api/v1/auth/register with missing password should return 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'nopass@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
      expect(res.body.message).toContain('password');
    });

    test('POST /api/v1/auth/register with short password (< 8 chars) should return 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'short@example.com', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
      expect(res.body.message).toContain('at least 8 characters');
    });

    test('POST /api/v1/auth/register with invalid email format should return 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'invalid-email-format', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
      expect(res.body.message).toContain('Invalid email format');
    });

    test('POST /api/v1/auth/login with missing email should return 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
    });
  });

  describe('2. UUID Identifier Validation', () => {
    test('GET /api/v1/datasets/:datasetId with malformed UUID should return 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .get('/api/v1/datasets/not-a-valid-uuid')
        .set('Authorization', `Bearer ${validUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
      expect(res.body.message).toContain('Invalid UUID format');
    });

    test('DELETE /api/v1/datasets/:datasetId with malformed UUID should return 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .delete('/api/v1/datasets/12345-invalid')
        .set('Authorization', `Bearer ${validUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
    });

    test('POST /api/v1/analysis/run with malformed version_id should return 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .post('/api/v1/analysis/run')
        .set('Authorization', `Bearer ${validUserToken}`)
        .send({ version_id: 'bad-version-uuid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
    });

    test('GET /api/v1/analysis/status/:job_id with malformed job_id should return 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .get('/api/v1/analysis/status/not-a-uuid')
        .set('Authorization', `Bearer ${validUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
    });
  });

  describe('3. String Length & Bound Constraints', () => {
    test('POST /api/v1/datasets with name exceeding 255 chars should return 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .post('/api/v1/datasets')
        .set('Authorization', `Bearer ${validUserToken}`)
        .send({ name: 'A'.repeat(256) });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
      expect(res.body.message).toContain('255 characters');
    });

    test('POST /api/v1/datasets with empty whitespace name should return 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .post('/api/v1/datasets')
        .set('Authorization', `Bearer ${validUserToken}`)
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
    });

    test('GET /api/v1/datasets/:id/history with invalid limit query should return 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .get(`/api/v1/datasets/${validDatasetId}/history?limit=invalid_number`)
        .set('Authorization', `Bearer ${validUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
    });
  });

  describe('4. Comparison Input Rules', () => {
    test('POST /api/v1/datasets/:id/compare with identical base and target version IDs should return 400 INVALID_INPUT', async () => {
      const res = await request(app)
        .post(`/api/v1/datasets/${validDatasetId}/compare`)
        .set('Authorization', `Bearer ${validUserToken}`)
        .send({
          base_version_id: validVersionId,
          target_version_id: validVersionId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
      expect(res.body.message).toContain('cannot be identical');
    });
  });

  describe('5. Malformed JSON Body Handling', () => {
    test('Request with malformed JSON body should return 400 INVALID_INPUT without 500 error', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "broken-json", "password": ');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
      expect(res.body.message).toContain('Malformed JSON');
    });
  });

  describe('6. Rate Limiting Middleware Functionality', () => {
    test('Rate limiter allows requests below limit and returns 429 TOO_MANY_REQUESTS when limit exceeded', async () => {
      const testApp = express();
      testApp.use(express.json());

      const testLimiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: 3,
        message: 'Test rate limit exceeded.',
      });

      testApp.get('/test-rate-limit', testLimiter as any, (req, res) => {
        res.status(200).json({ status: 'OK' });
      });

      // 3 allowed requests
      const req1 = await request(testApp).get('/test-rate-limit');
      expect(req1.status).toBe(200);

      const req2 = await request(testApp).get('/test-rate-limit');
      expect(req2.status).toBe(200);

      const req3 = await request(testApp).get('/test-rate-limit');
      expect(req3.status).toBe(200);

      // 4th request exceeds limit
      const req4 = await request(testApp).get('/test-rate-limit');
      expect(req4.status).toBe(429);
      expect(req4.body.error).toBe('TOO_MANY_REQUESTS');
      expect(req4.body.message).toBe('Test rate limit exceeded.');
      expect(req4.headers['retry-after']).toBeDefined();
    });
  });
});

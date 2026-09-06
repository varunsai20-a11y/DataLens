import request from 'supertest';
import app from '../app';
import { pool } from '../services/db';
import { authService } from '../services/authService';
import { auditService, sanitizeAuditMetadata } from '../services/auditService';
import { v4 as uuidv4 } from 'uuid';

jest.mock('../services/queueService', () => ({
  analysisQueue: { add: jest.fn(), getJob: jest.fn() },
  enqueueAnalysisJob: jest.fn().mockResolvedValue(undefined),
  reconcileOrphanedJobs: jest.fn().mockResolvedValue(undefined),
}));

describe('Phase 4.6 Audit Logging & Production Hardening Tests', () => {
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;
  let datasetId: string;

  const dbAuditLogs: any[] = [];
  const dbDatasets = new Map<string, any>();

  const handleQuery = async (sql: string, params?: any[]) => {
    const q = sql.trim().replace(/\s+/g, ' ').toUpperCase();

    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(q)) {
      return { rows: [], rowCount: 0 };
    }

    if (q.startsWith('INSERT INTO AUDIT_LOGS')) {
      const log = {
        id: uuidv4(),
        user_id: params![0],
        action: params![1],
        resource_type: params![2],
        resource_id: params![3],
        status: params![4],
        ip_address: params![5],
        user_agent: params![6],
        request_id: params![7],
        metadata: typeof params![8] === 'string' ? JSON.parse(params![8]) : params![8] || {},
        created_at: new Date().toISOString(),
      };
      dbAuditLogs.push(log);
      return { rows: [log], rowCount: 1 };
    }

    if (q.includes('FROM AUDIT_LOGS') && q.includes('COUNT(*)')) {
      const userLogs = params && params[0] ? dbAuditLogs.filter((l) => l.user_id === params[0]) : dbAuditLogs;
      return { rows: [{ total: userLogs.length }], rowCount: 1 };
    }

    if (q.includes('FROM AUDIT_LOGS') && q.includes('WHERE USER_ID = $1')) {
      const userLogs = dbAuditLogs.filter((l) => l.user_id === params![0]);
      return { rows: userLogs, rowCount: userLogs.length };
    }

    if (q.includes('FROM AUDIT_LOGS')) {
      return { rows: dbAuditLogs, rowCount: dbAuditLogs.length };
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
        description: params![1] || null,
        user_id: params![2] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      dbDatasets.set(id, ds);
      return { rows: [ds], rowCount: 1 };
    }

    if (q.startsWith('SELECT ID, EMAIL, PASSWORD_HASH')) {
      return {
        rows: [
          {
            id: userAId,
            email: 'userA@example.com',
            password_hash: '$2a$12$R.S5K4p.q9HwH9Lw4lK4u.9a7g2h5j8k1l4m7n0p3q6r9s2t5u8v1',
            name: 'User A',
            role: 'USER',
            is_system: false,
            created_at: new Date().toISOString(),
          },
        ],
        rowCount: 1,
      };
    }

    return { rows: [], rowCount: 0 };
  };

  beforeAll(() => {
    userAId = '11111111-1111-1111-1111-111111111111';
    userBId = '22222222-2222-2222-2222-222222222222';

    userAToken = authService.generateToken({
      id: userAId,
      email: 'userA@example.com',
      name: 'User A',
      role: 'USER',
      is_system: false,
      created_at: new Date().toISOString(),
    });

    userBToken = authService.generateToken({
      id: userBId,
      email: 'userB@example.com',
      name: 'User B',
      role: 'USER',
      is_system: false,
      created_at: new Date().toISOString(),
    });

    datasetId = '33333333-3333-3333-3333-333333333333';
    dbDatasets.set(datasetId, {
      id: datasetId,
      name: "User A's Dataset",
      description: 'Audit test dataset',
      user_id: userAId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  beforeEach(() => {
    const mockClient = {
      query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => handleQuery(sql, params)),
      release: jest.fn(),
    };
    (jest.spyOn(pool, 'connect') as jest.Mock).mockResolvedValue(mockClient);
    (jest.spyOn(pool, 'query') as jest.Mock).mockImplementation(handleQuery as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Sensitive Metadata Sanitization', () => {
    test('sanitizeAuditMetadata should redact sensitive fields (password, token, secret)', () => {
      const raw = {
        email: 'user@example.com',
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        secret: 'api_secret_key',
        nested: {
          password: 'nested_password',
          safe_field: 'visible_data',
        },
      };

      const sanitized = sanitizeAuditMetadata(raw);
      expect(sanitized.email).toBe('user@example.com');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.secret).toBe('[REDACTED]');
      expect(sanitized.nested.password).toBe('[REDACTED]');
      expect(sanitized.nested.safe_field).toBe('visible_data');
    });
  });

  describe('2. Non-blocking Audit Failure Resilience', () => {
    test('audit logging error should NOT cause dataset creation to fail', async () => {
      (jest.spyOn(pool, 'query') as jest.Mock).mockImplementation(async (sql: string, params?: any[]) => {
        const q = sql.trim().replace(/\s+/g, ' ').toUpperCase();
        if (q.startsWith('INSERT INTO AUDIT_LOGS')) {
          throw new Error('Database Connection Failed');
        }
        return handleQuery(sql, params);
      });

      const res = await request(app)
        .post('/api/v1/datasets')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'Resilient Audit Dataset' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('SUCCESS');
      expect(res.body.dataset.name).toBe('Resilient Audit Dataset');
    });
  });

  describe('3. Security & Business Audit Events', () => {
    test('dataset creation should generate DATASET_CREATE_SUCCESS audit log entry', async () => {
      const countBefore = dbAuditLogs.length;

      const res = await request(app)
        .post('/api/v1/datasets')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ name: 'Audited Financial Dataset' });

      expect(res.status).toBe(201);
      expect(dbAuditLogs.length).toBeGreaterThan(countBefore);

      const latestLog = dbAuditLogs[dbAuditLogs.length - 1];
      expect(latestLog.action).toBe('DATASET_CREATE_SUCCESS');
      expect(latestLog.user_id).toBe(userAId);
      expect(latestLog.resource_type).toBe('DATASET');
    });

    test('access denied (403) should generate ACCESS_DENIED audit log entry', async () => {
      const res = await request(app)
        .get(`/api/v1/datasets/${datasetId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);

      const deniedLog = dbAuditLogs.find((l) => l.action === 'ACCESS_DENIED');
      expect(deniedLog).toBeDefined();
      expect(deniedLog.user_id).toBe(userBId);
      expect(deniedLog.status).toBe('REJECTED');
      expect(deniedLog.resource_id).toBe(datasetId);
    });
  });

  describe('4. Tenant-Scoped Audit Log Access Endpoint', () => {
    test('GET /api/v1/audit-logs unauthenticated should return 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/audit-logs');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    test('GET /api/v1/audit-logs authenticated should return user-scoped audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs?limit=10&offset=0')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      expect(Array.isArray(res.body.logs)).toBe(true);

      // Verify returned logs belong to user A
      for (const log of res.body.logs) {
        expect(log.user_id).toBe(userAId);
      }
    });
  });
});

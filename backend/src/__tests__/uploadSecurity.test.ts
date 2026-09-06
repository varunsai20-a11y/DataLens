import path from 'path';
import fs from 'fs';

// Ensure storage path exists before app imports
const testStorageDir = path.join(__dirname, 'test_upload_security_storage');
if (!fs.existsSync(testStorageDir)) {
  fs.mkdirSync(testStorageDir, { recursive: true });
}
process.env.STORAGE_PATH = testStorageDir;

import request from 'supertest';
import app from '../app';
import { pool } from '../services/db';
import { authService } from '../services/authService';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFilename, isPathInsideDir, validateFileContent } from '../utils/fileValidation';

jest.mock('../services/queueService', () => ({
  analysisQueue: { add: jest.fn(), getJob: jest.fn() },
  enqueueAnalysisJob: jest.fn().mockResolvedValue(undefined),
  reconcileOrphanedJobs: jest.fn().mockResolvedValue(undefined),
}));

describe('Phase 4.4 Upload Security & File Validation Tests', () => {
  let validUserToken: string;
  let validUserId: string;
  let validDatasetId: string;

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
        description: params![1] || null,
        user_id: params![2] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      dbDatasets.set(id, ds);
      return { rows: [ds], rowCount: 1 };
    }

    if (q.startsWith('INSERT INTO DATASET_VERSIONS')) {
      const id = uuidv4();
      const version = {
        id,
        dataset_id: params![0],
        version_number: params![1] || 1,
        original_filename: params![2],
        stored_filename: params![3],
        file_path: params![4],
        checksum: params![5],
        file_size_bytes: params![6],
        mime_type: params![7],
        created_at: new Date().toISOString(),
      };
      dbVersions.set(id, version);
      return { rows: [version], rowCount: 1 };
    }

    if (q.includes('SELECT COALESCE(MAX(VERSION_NUMBER), 0)')) {
      return { rows: [{ max: 0 }], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  };

  beforeAll(() => {
    validUserId = '99999999-9999-9999-9999-999999999999';
    validUserToken = authService.generateToken({
      id: validUserId,
      email: 'uploaduser@example.com',
      name: 'Upload User',
      role: 'USER',
      is_system: false,
      created_at: new Date().toISOString(),
    });

    validDatasetId = '88888888-8888-8888-8888-888888888888';
    dbDatasets.set(validDatasetId, {
      id: validDatasetId,
      name: 'Security Test Dataset',
      description: 'Upload security testing',
      user_id: validUserId,
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

  afterAll(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  describe('A. File Validation Utility Unit Tests', () => {
    test('sanitizeFilename should remove path traversal and control characters', () => {
      expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
      expect(sanitizeFilename('..\\..\\Windows\\System32\\cmd.exe')).toBe('cmd.exe');
      expect(sanitizeFilename('test\0file\n.csv')).toBe('testfile.csv');
      expect(sanitizeFilename('....//....//secret.parquet')).toBe('secret.parquet');
    });

    test('isPathInsideDir should verify storage boundary containment', () => {
      const allowedDir = path.resolve(testStorageDir);
      const validPath = path.join(allowedDir, 'subfolder', 'file.csv');
      const invalidPath = path.resolve(testStorageDir, '..', 'outside.csv');

      expect(isPathInsideDir(validPath, allowedDir)).toBe(true);
      expect(isPathInsideDir(invalidPath, allowedDir)).toBe(false);
    });

    test('validateFileContent should validate CSV text and Parquet magic bytes', () => {
      const tempCsv = path.join(testStorageDir, 'temp_test.csv');
      fs.writeFileSync(tempCsv, 'col1,col2,col3\n1,2,3\n4,5,6\n');
      expect(validateFileContent(tempCsv, '.csv', fs.statSync(tempCsv).size)).toEqual({ valid: true });

      // Executable binary renamed to .csv
      const tempFakeCsv = path.join(testStorageDir, 'temp_fake.csv');
      const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ header
      fs.writeFileSync(tempFakeCsv, exeBuffer);
      expect(validateFileContent(tempFakeCsv, '.csv', exeBuffer.length).valid).toBe(false);

      // Valid Parquet magic bytes PAR1
      const tempParquet = path.join(testStorageDir, 'temp_test.parquet');
      const pqBuf = Buffer.concat([Buffer.from('PAR1'), Buffer.from([0x00, 0x00, 0x00, 0x00]), Buffer.from('PAR1')]);
      fs.writeFileSync(tempParquet, pqBuf);
      expect(validateFileContent(tempParquet, '.parquet', pqBuf.length)).toEqual({ valid: true });

      // Invalid Parquet magic bytes
      const tempFakeParquet = path.join(testStorageDir, 'temp_fake.parquet');
      fs.writeFileSync(tempFakeParquet, 'Not a parquet file format');
      expect(validateFileContent(tempFakeParquet, '.parquet', 24).valid).toBe(false);

      // Clean up temp unit test files
      [tempCsv, tempFakeCsv, tempParquet, tempFakeParquet].forEach((f) => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });
    });
  });

  describe('B. Upload Security Endpoint Tests', () => {
    test('1. Valid CSV upload should succeed with HTTP 201', async () => {
      const csvData = 'id,name,val\n1,Alpha,100\n2,Beta,200\n';

      const res = await request(app)
        .post(`/api/v1/datasets/${validDatasetId}/upload`)
        .set('Authorization', `Bearer ${validUserToken}`)
        .attach('file', Buffer.from(csvData), 'valid_dataset.csv');

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('SUCCESS');
      expect(res.body.version.original_filename).toBe('valid_dataset.csv');
    });

    test('2. Valid Parquet upload (PAR1 magic bytes) should succeed with HTTP 201', async () => {
      const parquetData = Buffer.concat([
        Buffer.from('PAR1'),
        Buffer.from('mock parquet column data payload'),
        Buffer.from('PAR1'),
      ]);

      const res = await request(app)
        .post(`/api/v1/datasets/${validDatasetId}/upload`)
        .set('Authorization', `Bearer ${validUserToken}`)
        .attach('file', parquetData, 'data_sample.parquet');

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('SUCCESS');
      expect(res.body.version.original_filename).toBe('data_sample.parquet');
    });

    test('3. Unsupported file extension (.exe) should return HTTP 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/v1/datasets/${validDatasetId}/upload`)
        .set('Authorization', `Bearer ${validUserToken}`)
        .attach('file', Buffer.from('malicious binary content'), 'payload.exe');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
      expect(res.body.message).toContain('Only CSV (.csv) and Parquet (.parquet) files are supported');
    });

    test('4. Path traversal filename (../../etc/passwd.csv) should sanitize filename and maintain storage boundary', async () => {
      const csvData = 'header1,header2\nval1,val2\n';

      const res = await request(app)
        .post(`/api/v1/datasets/${validDatasetId}/upload`)
        .set('Authorization', `Bearer ${validUserToken}`)
        .attach('file', Buffer.from(csvData), '../../etc/passwd.csv');

      expect(res.status).toBe(201);
      expect(res.body.version.original_filename).toBe('passwd.csv');
    });

    test('5. Binary executable disguised as CSV (.csv with MZ header) should return HTTP 400 and clean up temporary file', async () => {
      const beforeFiles = fs.readdirSync(testStorageDir).length;
      const exeContent = Buffer.concat([
        Buffer.from([0x4d, 0x5a, 0x90, 0x00]), // Windows executable MZ header
        Buffer.from('This is actually a binary executable file disguised as csv'),
      ]);

      const res = await request(app)
        .post(`/api/v1/datasets/${validDatasetId}/upload`)
        .set('Authorization', `Bearer ${validUserToken}`)
        .attach('file', exeContent, 'malware.csv');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_FILE_CONTENT');
      expect(res.body.message).toContain('Binary file signature detected');

      // Verify cleanup: no orphan file remains in storage directory
      const afterFiles = fs.readdirSync(testStorageDir).length;
      expect(afterFiles).toBe(beforeFiles);
    });

    test('6. Fake Parquet file (missing PAR1 magic bytes) should return HTTP 400 and clean up temporary file', async () => {
      const beforeFiles = fs.readdirSync(testStorageDir).length;
      const fakeParquet = Buffer.from('This file has .parquet extension but no PAR1 magic header');

      const res = await request(app)
        .post(`/api/v1/datasets/${validDatasetId}/upload`)
        .set('Authorization', `Bearer ${validUserToken}`)
        .attach('file', fakeParquet, 'fake.parquet');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_FILE_CONTENT');
      expect(res.body.message).toContain('Invalid Parquet magic bytes');

      // Verify cleanup: no orphan file remains
      const afterFiles = fs.readdirSync(testStorageDir).length;
      expect(afterFiles).toBe(beforeFiles);
    });

    test('7. Empty file (0 bytes) should return HTTP 400 and clean up temporary file', async () => {
      const beforeFiles = fs.readdirSync(testStorageDir).length;

      const res = await request(app)
        .post(`/api/v1/datasets/${validDatasetId}/upload`)
        .set('Authorization', `Bearer ${validUserToken}`)
        .attach('file', Buffer.alloc(0), 'empty.csv');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('EMPTY_FILE');

      // Verify cleanup: no orphan file remains
      const afterFiles = fs.readdirSync(testStorageDir).length;
      expect(afterFiles).toBe(beforeFiles);
    });
  });
});

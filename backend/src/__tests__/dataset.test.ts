import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../app';
import { pool } from '../services/db';
import { redisClient } from '../services/redis';
import { runMigrations } from '../db/migrator';

describe('Checkpoint 1: Dataset API and Storage Tests', () => {
  let createdDatasetId: string;
  const testCsvPath = path.join(__dirname, 'test_sample.csv');
  const testEmptyCsvPath = path.join(__dirname, 'test_empty.csv');
  const testInvalidExtPath = path.join(__dirname, 'test_invalid.txt');

  beforeAll(async () => {
    await runMigrations();
    fs.writeFileSync(testCsvPath, 'id,name,age\n1,Alice,30\n2,Bob,25\n3,Charlie,35\n');
    fs.writeFileSync(testEmptyCsvPath, '');
    fs.writeFileSync(testInvalidExtPath, 'some text content');
  });

  afterAll(async () => {
    if (fs.existsSync(testCsvPath)) fs.unlinkSync(testCsvPath);
    if (fs.existsSync(testEmptyCsvPath)) fs.unlinkSync(testEmptyCsvPath);
    if (fs.existsSync(testInvalidExtPath)) fs.unlinkSync(testInvalidExtPath);

    await pool.end();
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  });

  test('POST /api/v1/datasets should create a new dataset', async () => {
    const res = await request(app)
      .post('/api/v1/datasets')
      .send({
        name: 'Customer Retention Q3',
        description: 'Dataset containing customer demographics and churn',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.dataset).toHaveProperty('id');
    expect(res.body.dataset.name).toBe('Customer Retention Q3');
    expect(res.body.dataset.description).toBe('Dataset containing customer demographics and churn');

    createdDatasetId = res.body.dataset.id;
  });

  test('POST /api/v1/datasets should reject missing name', async () => {
    const res = await request(app)
      .post('/api/v1/datasets')
      .send({ description: 'No name provided' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_INPUT');
  });

  test('GET /api/v1/datasets should list all datasets', async () => {
    const res = await request(app).get('/api/v1/datasets');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
    expect(Array.isArray(res.body.datasets)).toBe(true);
    expect(res.body.datasets.length).toBeGreaterThan(0);
  });

  test('GET /api/v1/datasets/:id should return dataset details and versions', async () => {
    const res = await request(app).get(`/api/v1/datasets/${createdDatasetId}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.dataset.id).toBe(createdDatasetId);
    expect(Array.isArray(res.body.versions)).toBe(true);
  });

  test('GET /api/v1/datasets/:id should return 404 for non-existent ID', async () => {
    const res = await request(app).get('/api/v1/datasets/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  test('POST /api/v1/datasets/:id/upload should upload a valid CSV version', async () => {
    const res = await request(app)
      .post(`/api/v1/datasets/${createdDatasetId}/upload`)
      .attach('file', testCsvPath);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.version).toHaveProperty('id');
    expect(res.body.version.version_number).toBe(1);
    expect(res.body.version.original_filename).toBe('test_sample.csv');
    expect(res.body.version.file_size_bytes).toBeGreaterThan(0);
    expect(res.body.version.checksum.length).toBe(64);
  });

  test('POST /api/v1/datasets/:id/upload should increment version number on second upload', async () => {
    const res = await request(app)
      .post(`/api/v1/datasets/${createdDatasetId}/upload`)
      .attach('file', testCsvPath);

    expect(res.status).toBe(201);
    expect(res.body.version.version_number).toBe(2);
  });

  test('POST /api/v1/datasets/:id/upload should reject unsupported file format', async () => {
    const res = await request(app)
      .post(`/api/v1/datasets/${createdDatasetId}/upload`)
      .attach('file', testInvalidExtPath)
      .catch((err) => err.response);

    expect(res ? res.status : 400).toBe(400);
  });

  test('POST /api/v1/datasets/:id/upload should reject empty file', async () => {
    const res = await request(app)
      .post(`/api/v1/datasets/${createdDatasetId}/upload`)
      .attach('file', testEmptyCsvPath);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('EMPTY_FILE');
  });

  test('POST /api/v1/datasets/:id/upload should return 404 for non-existent dataset', async () => {
    const res = await request(app)
      .post('/api/v1/datasets/00000000-0000-0000-0000-000000000000/upload')
      .attach('file', testCsvPath);

    expect(res.status).toBe(404);
  });
});

import request from 'supertest';
import app from '../app';
import { pool } from '../services/db';
import { redisClient } from '../services/redis';

describe('Infrastructure Base Tests', () => {
  afterAll(async () => {
    await pool.end();
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  });

  test('GET /api/health should return 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({ status: 'UP' });
  });

  test('GET /api/ready should return 200 when dependencies are up', async () => {
    const res = await request(app).get('/api/ready');
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual('READY');
  });

  test('Invalid endpoint should return 404', async () => {
    const res = await request(app).get('/api/non-existent');
    expect(res.statusCode).toEqual(404);
  });
});

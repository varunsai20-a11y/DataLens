import request from 'supertest';
import app from '../app';
import { aiInterpretationService } from '../services/aiInterpretationService';
import { analysisService } from '../services/analysisService';

describe('Phase 5.3 Reliability & Observability Test Suite', () => {
  describe('Request Correlation & ID Propagation', () => {
    test('should assign X-Request-Id header to incoming requests if missing', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.headers['x-request-id']).toBeDefined();
      expect(typeof res.headers['x-request-id']).toBe('string');
      expect(res.headers['x-request-id'].length).toBeGreaterThan(0);
    });

    test('should preserve incoming X-Request-Id header when provided', async () => {
      const customId = 'custom-correlation-id-12345';
      const res = await request(app)
        .get('/api/health')
        .set('X-Request-Id', customId);

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-request-id']).toBe(customId);
    });

    test('should include requestId in error responses', async () => {
      const customId = 'err-correlation-id-999';
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Request-Id', customId)
        .send({ email: 'invalid-email' });

      expect(res.statusCode).toBe(400);
      expect(res.body.requestId).toBe(customId);
      expect(res.body.error).toBe('INVALID_INPUT');
    });
  });

  describe('Error Sanitization & Taxonomies', () => {
    test('should return machine-readable BAD_REQUEST error on malformed JSON body', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid_json": ');

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('INVALID_INPUT');
      expect(res.body.message).toContain('Malformed JSON');
    });

    test('should return 401 UNAUTHORIZED on missing auth token', async () => {
      const res = await request(app).get('/api/v1/datasets');
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    test('should return 401 UNAUTHORIZED on invalid JWT format', async () => {
      const res = await request(app)
        .get('/api/v1/datasets')
        .set('Authorization', 'Bearer invalid-token-string');

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('Health vs Readiness Separation', () => {
    test('Liveness probe GET /api/health should always return 200 UP', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ status: 'UP' });
    });
  });

  describe('AI Interpretation Resilience & Fallback Engine', () => {
    test('should generate structured deterministic fallback when input is sanitized', () => {
      const mockSanitizedInput = {
        dataset_name: 'Reliability Test Dataset',
        version: 2,
        overall_quality_score: 65,
        intrinsic_quality_score: 65,
        drift_impact_score: 40,
        combined_health_score: 52.5,
        health_status: 'AT_RISK',
        summary: { row_count: 500, column_count: 5, total_missing_percentage: 2.5 },
        schema_changes: [
          {
            column: 'user_id',
            change_type: 'REMOVED',
            base_type: 'INTEGER',
            target_type: null,
            severity: 'CRITICAL',
            message: "Column 'user_id' was removed.",
          },
        ],
        distribution_drift: [
          {
            column: 'purchase_amount',
            feature_type: 'NUMERICAL',
            method: 'KOLMOGOROV_SMIRNOV',
            statistic: 0.45,
            p_value: 0.001,
            psi_score: null,
            severity: 'SEVERE_DRIFT',
            interpretation: 'Statistically significant shift detected.',
          },
        ],
        quality_findings: [
          {
            type: 'MISSING_VALUES',
            severity: 'HIGH',
            column: 'email',
            message: 'High missing percentage in column email.',
          },
        ],
      };

      const fallback = aiInterpretationService.generateFallback(mockSanitizedInput);

      expect(fallback).toBeDefined();
      expect(fallback.source).toBe('FALLBACK');
      expect(fallback.severity).toBe('CRITICAL');
      expect(fallback.summary).toContain('Reliability Test Dataset');
      expect(fallback.key_findings.length).toBeGreaterThan(0);
      expect(fallback.likely_causes.length).toBeGreaterThan(0);
      expect(fallback.recommended_actions.length).toBeGreaterThan(0);
    });
  });
});

import request from 'supertest';
import app from '../app';
import { aiInterpretationService } from '../services/aiInterpretationService';
import { datasetService } from '../services/datasetService';
import { analysisService } from '../services/analysisService';
import { comparisonService } from '../services/comparisonService';

jest.mock('../services/queueService', () => ({
  analysisQueue: { add: jest.fn(), getJob: jest.fn() },
  enqueueAnalysisJob: jest.fn().mockResolvedValue(undefined),
  reconcileOrphanedJobs: jest.fn().mockResolvedValue(undefined),
}));

describe('Phase 3.3 AI Interpretation & Fallback Unit Tests', () => {
  describe('Sanitized Input & Fallback Logic (Pure Unit Tests)', () => {
    test('buildSanitizedInput should filter findings down to compact metadata without raw records', () => {
      const fakeAnalysisRecord: any = {
        id: 'res-1',
        job_id: 'job-1',
        dataset_version_id: 'v-1',
        analysis_version: '1.0.0',
        overall_quality_score: 85,
        dimensions: {},
        summary: JSON.stringify({ row_count: 500, column_count: 10, total_missing_percentage: 1.5 }),
        profiling: [],
        quality_checks: JSON.stringify([{ type: 'NULL_CHECK', severity: 'HIGH', column: 'email', message: 'High missingness' }]),
        outliers: [],
        recommendations: [],
        created_at: new Date().toISOString(),
      };

      const sanitized = aiInterpretationService.buildSanitizedInput('Test dataset', 2, fakeAnalysisRecord);

      expect(sanitized.dataset_name).toBe('Test dataset');
      expect(sanitized.version).toBe(2);
      expect(sanitized.overall_quality_score).toBe(85);
      expect(sanitized.summary.row_count).toBe(500);
      expect(sanitized.quality_findings.length).toBe(1);
      expect(sanitized.quality_findings[0].column).toBe('email');
      // Ensure privacy compliance (no raw records or storage paths)
      expect(sanitized.raw_records).toBeUndefined();
      expect(sanitized.storage_path).toBeUndefined();
      expect(sanitized.file_path).toBeUndefined();
    });

    test('generateFallback should handle REMOVED column with CRITICAL severity', () => {
      const input = {
        dataset_name: 'E-commerce',
        version: 2,
        intrinsic_quality_score: 90,
        combined_health_score: 60,
        health_status: 'AT_RISK',
        schema_changes: [
          { column: 'user_id', change_type: 'REMOVED', severity: 'CRITICAL' },
        ],
        distribution_drift: [],
        quality_findings: [],
      };

      const fallback = aiInterpretationService.generateFallback(input);

      expect(fallback.source).toBe('FALLBACK');
      expect(fallback.severity).toBe('CRITICAL');
      expect(fallback.key_findings.some((f) => f.includes('user_id') && f.includes('removed'))).toBe(true);
      expect(fallback.recommended_actions.some((a) => a.includes('upstream'))).toBe(true);
    });

    test('generateFallback should handle TYPE_CHANGED with HIGH severity', () => {
      const input = {
        dataset_name: 'E-commerce',
        version: 2,
        intrinsic_quality_score: 90,
        combined_health_score: 80,
        health_status: 'STABLE',
        schema_changes: [
          { column: 'price', change_type: 'TYPE_CHANGED', base_type: 'float', target_type: 'string', severity: 'HIGH' },
        ],
        distribution_drift: [],
        quality_findings: [],
      };

      const fallback = aiInterpretationService.generateFallback(input);

      expect(fallback.severity).toBe('HIGH');
      expect(fallback.key_findings.some((f) => f.includes('price') && f.includes('type changed'))).toBe(true);
      expect(fallback.recommended_actions.some((a) => a.includes('schema contracts'))).toBe(true);
    });

    test('generateFallback should handle SEVERE_DRIFT with HIGH/CRITICAL severity', () => {
      const input = {
        dataset_name: 'E-commerce',
        version: 2,
        intrinsic_quality_score: 90,
        combined_health_score: 75,
        health_status: 'STABLE',
        schema_changes: [],
        distribution_drift: [
          { column: 'age', method: 'KS test', statistic: 0.42, severity: 'SEVERE_DRIFT' },
        ],
        quality_findings: [],
      };

      const fallback = aiInterpretationService.generateFallback(input);

      expect(['HIGH', 'CRITICAL'].includes(fallback.severity)).toBe(true);
      expect(fallback.key_findings.some((f) => f.includes('age') && f.includes('Severe feature distribution drift'))).toBe(true);
      expect(fallback.recommended_actions.some((a) => a.includes('retraining'))).toBe(true);
    });

    test('validateInterpretation should validate and format fallback interpretation structure', () => {
      const rawObj = {
        summary: ' Test summary ',
        key_findings: ['Finding A'],
        likely_causes: ['Cause A'],
        recommended_actions: ['Action A'],
        severity: 'high',
      };

      const validated = aiInterpretationService.validateInterpretation(rawObj, 'FALLBACK');

      expect(validated.summary).toBe('Test summary');
      expect(validated.severity).toBe('HIGH');
      expect(validated.source).toBe('FALLBACK');
      expect(validated.key_findings).toEqual(['Finding A']);
    });
  });

  describe('API Endpoint Integration Unit Tests (Mocked DB)', () => {
    test('POST /api/v1/datasets/:id/ai-interpretation should return 200 with fallback interpretation', async () => {
      const datasetId = '11111111-1111-1111-1111-111111111111';
      const versionId = '22222222-2222-2222-2222-222222222222';

      jest.spyOn(datasetService, 'getDatasetById').mockResolvedValueOnce({
        dataset: { id: datasetId, name: 'Mock Dataset', description: 'Test', created_at: '', updated_at: '' },
        versions: [
          { id: versionId, dataset_id: datasetId, version_number: 1, original_filename: 'v1.csv', stored_filename: 'v1.csv', checksum: 'hash', file_size_bytes: 100, mime_type: 'text/csv', created_at: '' }
        ]
      } as any);

      jest.spyOn(analysisService, 'getLatestAnalysisForVersion').mockResolvedValueOnce({
        id: 'res-id',
        job_id: 'job-id',
        dataset_version_id: versionId,
        analysis_version: '1.0.0',
        overall_quality_score: 92.5,
        dimensions: {} as any,
        summary: { row_count: 100, column_count: 5, total_missing_percentage: 0 },
        profiling: [],
        quality_checks: [],
        outliers: [],
        recommendations: [],
        created_at: new Date().toISOString(),
      });

      const res = await request(app)
        .post(`/api/v1/datasets/${datasetId}/ai-interpretation`)
        .send({ version_id: versionId });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUCCESS');
      expect(res.body.interpretation).toBeDefined();
      expect(res.body.interpretation.source).toBe('FALLBACK');
      expect(res.body.interpretation.summary).toBeDefined();
    });

    test('POST /api/v1/datasets/:id/ai-interpretation should return 404 for nonexistent dataset', async () => {
      jest.spyOn(datasetService, 'getDatasetById').mockResolvedValueOnce(null);

      const res = await request(app)
        .post(`/api/v1/datasets/00000000-0000-0000-0000-000000000000/ai-interpretation`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });

    test('getOrGenerateInterpretation should default to latest analyzed version when versionId is omitted', async () => {
      const datasetId = '33333333-3333-3333-3333-333333333333';
      const v1Id = 'v1-uuid';
      const v2Id = 'v2-uuid';

      jest.spyOn(datasetService, 'getDatasetById').mockResolvedValueOnce({
        dataset: { id: datasetId, name: 'Versioned Dataset', description: 'Test', created_at: '', updated_at: '' },
        versions: [
          { id: v1Id, dataset_id: datasetId, version_number: 1, original_filename: 'v1.csv', stored_filename: 'v1.csv', checksum: 'h1', file_size_bytes: 100, mime_type: 'text/csv', created_at: '' },
          { id: v2Id, dataset_id: datasetId, version_number: 2, original_filename: 'v2.csv', stored_filename: 'v2.csv', checksum: 'h2', file_size_bytes: 120, mime_type: 'text/csv', created_at: '' },
        ]
      } as any);

      const getLatestSpy = jest.spyOn(analysisService, 'getLatestAnalysisForVersion').mockResolvedValueOnce({
        id: 'res-v2',
        job_id: 'job-v2',
        dataset_version_id: v2Id,
        analysis_version: '1.0.0',
        overall_quality_score: 88,
        dimensions: {} as any,
        summary: { row_count: 200, column_count: 6, total_missing_percentage: 0 },
        profiling: [],
        quality_checks: [],
        outliers: [],
        recommendations: [],
        created_at: new Date().toISOString(),
      });

      const interp = await aiInterpretationService.getOrGenerateInterpretation(datasetId);

      expect(getLatestSpy).toHaveBeenCalledWith(v2Id);
      expect(interp.summary).toContain('v2');
    });

    test('getOrGenerateInterpretation should respect explicitly provided versionId', async () => {
      const datasetId = '33333333-3333-3333-3333-333333333333';
      const v1Id = 'v1-uuid';
      const v2Id = 'v2-uuid';

      jest.spyOn(datasetService, 'getDatasetById').mockResolvedValueOnce({
        dataset: { id: datasetId, name: 'Versioned Dataset', description: 'Test', created_at: '', updated_at: '' },
        versions: [
          { id: v1Id, dataset_id: datasetId, version_number: 1, original_filename: 'v1.csv', stored_filename: 'v1.csv', checksum: 'h1', file_size_bytes: 100, mime_type: 'text/csv', created_at: '' },
          { id: v2Id, dataset_id: datasetId, version_number: 2, original_filename: 'v2.csv', stored_filename: 'v2.csv', checksum: 'h2', file_size_bytes: 120, mime_type: 'text/csv', created_at: '' },
        ]
      } as any);

      const getLatestSpy = jest.spyOn(analysisService, 'getLatestAnalysisForVersion').mockResolvedValueOnce({
        id: 'res-v1',
        job_id: 'job-v1',
        dataset_version_id: v1Id,
        analysis_version: '1.0.0',
        overall_quality_score: 95,
        dimensions: {} as any,
        summary: { row_count: 100, column_count: 5, total_missing_percentage: 0 },
        profiling: [],
        quality_checks: [],
        outliers: [],
        recommendations: [],
        created_at: new Date().toISOString(),
      });

      const interp = await aiInterpretationService.getOrGenerateInterpretation(datasetId, v1Id);

      expect(getLatestSpy).toHaveBeenCalledWith(v1Id);
      expect(interp.summary).toContain('v1');
    });

    test('getOrGenerateInterpretation should return cached ai_summary without regenerating', async () => {
      const datasetId = '44444444-4444-4444-4444-444444444444';
      const v1Id = 'v1-cached-uuid';
      const cachedSummary = {
        summary: 'Cached interpretation text',
        key_findings: ['Cached finding'],
        likely_causes: ['Cached cause'],
        recommended_actions: ['Cached action'],
        severity: 'LOW',
        source: 'FALLBACK',
      };

      jest.spyOn(datasetService, 'getDatasetById').mockResolvedValueOnce({
        dataset: { id: datasetId, name: 'Cached Dataset', description: 'Test', created_at: '', updated_at: '' },
        versions: [
          { id: v1Id, dataset_id: datasetId, version_number: 1, original_filename: 'v1.csv', stored_filename: 'v1.csv', checksum: 'h1', file_size_bytes: 100, mime_type: 'text/csv', created_at: '' },
        ]
      } as any);

      jest.spyOn(analysisService, 'getLatestAnalysisForVersion').mockResolvedValueOnce({
        id: 'res-cached',
        job_id: 'job-cached',
        dataset_version_id: v1Id,
        analysis_version: '1.0.0',
        overall_quality_score: 95,
        dimensions: {} as any,
        summary: { row_count: 100, column_count: 5, total_missing_percentage: 0 },
        profiling: [],
        quality_checks: [],
        outliers: [],
        recommendations: [],
        ai_summary: cachedSummary,
        created_at: new Date().toISOString(),
      } as any);

      const interp = await aiInterpretationService.getOrGenerateInterpretation(datasetId, v1Id);

      expect(interp.summary).toBe('Cached interpretation text');
      expect(interp.key_findings).toEqual(['Cached finding']);
    });
  });
});


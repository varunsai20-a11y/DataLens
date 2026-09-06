import { pool } from './db';
import { config } from '../config';
import { datasetService } from './datasetService';
import { analysisService } from './analysisService';
import logger from '../utils/logger';

export interface VersionComparisonRecord {
  id: string;
  dataset_id: string;
  base_version_id: string;
  target_version_id: string;
  comparison_result: any;
  score_delta: number;
  created_at: string;
}

export class ComparisonService {
  async compareVersions(
    datasetId: string,
    baseVersionId: string,
    targetVersionId: string
  ): Promise<VersionComparisonRecord> {
    if (baseVersionId === targetVersionId) {
      throw new Error('Base version and target version cannot be identical');
    }

    // 1. Idempotency Check
    const existingRes = await pool.query(
      `SELECT * FROM version_comparisons WHERE base_version_id = $1 AND target_version_id = $2`,
      [baseVersionId, targetVersionId]
    );

    if (existingRes.rows.length > 0) {
      logger.info(`Returning cached version comparison for ${baseVersionId} vs ${targetVersionId}`);
      return existingRes.rows[0];
    }

    // 2. Fetch versions and analysis results
    const baseVersion = await datasetService.getDatasetVersionById(baseVersionId);
    const targetVersion = await datasetService.getDatasetVersionById(targetVersionId);

    if (!baseVersion || !targetVersion) {
      throw new Error('Base or target dataset version not found');
    }

    const baseAnalysis = await analysisService.getLatestAnalysisForVersion(baseVersionId);
    const targetAnalysis = await analysisService.getLatestAnalysisForVersion(targetVersionId);

    if (!baseAnalysis || !targetAnalysis) {
      throw new Error('Analysis report missing for base or target version. Please analyze both versions first.');
    }

    // 3. Call Python Data Engine for diff and drift calculations
    logger.info(`Calling Python Data Engine POST /compare for ${baseVersionId} vs ${targetVersionId}`);

    const res = await fetch(`${config.dataEngineUrl}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_file_path: baseVersion.storage_path,
        target_file_path: targetVersion.storage_path,
        base_report: {
          summary: baseAnalysis.summary,
          columns: baseAnalysis.profiling,
          score: { overall: Number(baseAnalysis.overall_quality_score) },
        },
        target_report: {
          summary: targetAnalysis.summary,
          columns: targetAnalysis.profiling,
          score: { overall: Number(targetAnalysis.overall_quality_score) },
        },
      }),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as any;
      throw new Error(errBody.message || `Data Engine comparison failed with HTTP ${res.status}`);
    }

    const body = (await res.json()) as any;
    const comparisonResult = body.comparison;
    const scoreDelta = comparisonResult.metrics_summary.quality_score_delta || 0.0;

    // 4. Save to PostgreSQL
    const insertRes = await pool.query(
      `INSERT INTO version_comparisons
       (dataset_id, base_version_id, target_version_id, comparison_result, score_delta)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (base_version_id, target_version_id)
       DO UPDATE SET comparison_result = EXCLUDED.comparison_result, score_delta = EXCLUDED.score_delta
       RETURNING id, dataset_id, base_version_id, target_version_id, comparison_result, score_delta, created_at`,
      [datasetId, baseVersionId, targetVersionId, JSON.stringify(comparisonResult), scoreDelta]
    );

    logger.info(`Saved version comparison ${insertRes.rows[0].id}`);
    return insertRes.rows[0];
  }

  async getComparisonById(id: string): Promise<VersionComparisonRecord | null> {
    const res = await pool.query(`SELECT * FROM version_comparisons WHERE id = $1`, [id]);
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  async getComparisonByVersions(baseVersionId: string, targetVersionId: string): Promise<VersionComparisonRecord | null> {
    const res = await pool.query(
      `SELECT * FROM version_comparisons WHERE base_version_id = $1 AND target_version_id = $2`,
      [baseVersionId, targetVersionId]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  }
}

export const comparisonService = new ComparisonService();

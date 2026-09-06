import { pool } from './db';

export interface QualityHistoryItem {
  version_id: string;
  version_number: number;
  original_filename: string;
  created_at: string;
  overall_quality_score: number;
  intrinsic_quality_score: number;
  drift_impact_score: number;
  combined_health_score: number;
  health_status: string;
  dimensions: any;
  summary: any;
  issue_count: number;
  anomaly_count: number;
}

function classifyHealthStatus(score: number): string {
  if (score >= 90.0) return 'HEALTHY';
  if (score >= 75.0) return 'STABLE';
  if (score >= 60.0) return 'AT_RISK';
  if (score >= 40.0) return 'DEGRADED';
  return 'CRITICAL';
}

export class QualityHistoryService {
  async getDatasetHistory(datasetId: string): Promise<QualityHistoryItem[]> {
    const res = await pool.query(
      `SELECT
         v.id AS version_id,
         v.version_number,
         v.original_filename,
         v.created_at,
         r.overall_quality_score,
         r.dimensions,
         r.summary,
         jsonb_array_length(r.quality_checks) AS issue_count,
         jsonb_array_length(r.outliers) AS anomaly_count,
         vc.comparison_result
       FROM dataset_versions v
       JOIN analysis_jobs j ON j.dataset_version_id = v.id
       JOIN analysis_results r ON r.job_id = j.id
       LEFT JOIN version_comparisons vc ON vc.target_version_id = v.id
       WHERE v.dataset_id = $1 AND j.status = 'COMPLETED'
       ORDER BY v.version_number ASC`,
      [datasetId]
    );

    return res.rows.map((row) => {
      const overallScore = Number(row.overall_quality_score);
      let driftImpact = 100.0;
      let combinedHealth = overallScore;
      let status = classifyHealthStatus(overallScore);

      if (row.comparison_result) {
        const comp = typeof row.comparison_result === 'string' ? JSON.parse(row.comparison_result) : row.comparison_result;
        const metrics = comp.metrics_summary || comp;
        if (typeof metrics.drift_impact_score === 'number') {
          driftImpact = Number(metrics.drift_impact_score);
        }
        if (typeof metrics.combined_health_score === 'number') {
          combinedHealth = Number(metrics.combined_health_score);
        }
        if (metrics.health_status) {
          status = metrics.health_status;
        }
      }

      return {
        version_id: row.version_id,
        version_number: row.version_number,
        original_filename: row.original_filename,
        created_at: row.created_at,
        overall_quality_score: overallScore,
        intrinsic_quality_score: overallScore,
        drift_impact_score: driftImpact,
        combined_health_score: combinedHealth,
        health_status: status,
        dimensions: row.dimensions,
        summary: row.summary,
        issue_count: Number(row.issue_count || 0),
        anomaly_count: Number(row.anomaly_count || 0),
      };
    });
  }
}

export const qualityHistoryService = new QualityHistoryService();

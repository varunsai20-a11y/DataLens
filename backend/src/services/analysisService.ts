import fs from 'fs';
import { pool } from './db';
import { config } from '../config';
import { datasetService, DatasetVersion } from './datasetService';
import { enqueueAnalysisJob } from './queueService';
import logger from '../utils/logger';

export interface AnalysisJob {
  id: string;
  dataset_version_id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error_message: string | null;
  retry_count?: number;
  max_retries?: number;
  last_error?: string | null;
  failed_at?: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisResultRecord {
  id: string;
  job_id: string;
  dataset_version_id: string;
  analysis_version: string;
  overall_quality_score: number;
  dimensions: any;
  summary: any;
  profiling: any;
  quality_checks: any;
  outliers: any;
  recommendations: any;
  created_at: string;
}

export class AnalysisService {
  async createJob(versionId: string, userId?: string): Promise<{ job: AnalysisJob; version: DatasetVersion }> {
    const version = await datasetService.getDatasetVersionById(versionId);
    if (!version) {
      throw new Error('Dataset version not found');
    }

    if (userId) {
      const ownerRes = await pool.query(`SELECT user_id FROM datasets WHERE id = $1`, [version.dataset_id]);
      if (ownerRes.rows.length === 0 || ownerRes.rows[0].user_id !== userId) {
        throw new Error('FORBIDDEN: You do not have permission to analyze this dataset.');
      }
    }

    if (!fs.existsSync(version.storage_path)) {
      logger.error(`Storage file missing on disk: ${version.storage_path}`);
      throw new Error('Stored dataset file not found on disk');
    }

    const res = await pool.query(
      `INSERT INTO analysis_jobs (dataset_version_id, status, started_at)
       VALUES ($1, 'PENDING', NULL)
       RETURNING id, dataset_version_id, status, error_message, started_at, completed_at, created_at, updated_at`,
      [versionId]
    );

    const job = res.rows[0];
    logger.info(`Created analysis job ${job.id} for version ${versionId}`);

    // Enqueue to BullMQ
    await enqueueAnalysisJob(job.id, versionId);

    return { job, version };
  }

  async retryJob(jobId: string, userId?: string): Promise<{ job: AnalysisJob; version: DatasetVersion }> {
    const jobRes = await pool.query(`SELECT * FROM analysis_jobs WHERE id = $1`, [jobId]);
    if (jobRes.rows.length === 0) {
      throw new Error('Job not found');
    }
    const job = jobRes.rows[0];
    const version = await datasetService.getDatasetVersionById(job.dataset_version_id);
    if (!version) {
      throw new Error('Dataset version not found');
    }

    if (userId) {
      const ownerRes = await pool.query(`SELECT user_id FROM datasets WHERE id = $1`, [version.dataset_id]);
      if (ownerRes.rows.length === 0 || ownerRes.rows[0].user_id !== userId) {
        throw new Error('FORBIDDEN: You do not have permission to retry this job.');
      }
    }

    // Reset job state to PENDING in PostgreSQL
    await pool.query(
      `UPDATE analysis_jobs
       SET status = 'PENDING', error_message = NULL, last_error = NULL, retry_count = 0, completed_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [jobId]
    );

    await enqueueAnalysisJob(jobId, version.id);
    logger.info(`Manually retried job ${jobId} and re-enqueued to BullMQ`);

    return { job, version };
  }

  async triggerEngineAnalysis(jobId: string, version: DatasetVersion): Promise<void> {
    await enqueueAnalysisJob(jobId, version.id);
  }

  async handleJobSuccess(jobId: string, report: any): Promise<AnalysisResultRecord> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const jobRes = await client.query('SELECT * FROM analysis_jobs WHERE id = $1 FOR UPDATE', [jobId]);
      if (jobRes.rows.length === 0) {
        throw new Error(`Job ${jobId} not found`);
      }

      const job = jobRes.rows[0];

      // Update job to COMPLETED
      await client.query(
        `UPDATE analysis_jobs
         SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW(), error_message = NULL
         WHERE id = $1`,
        [jobId]
      );

      // Check if analysis_result already exists (idempotency)
      const existingRes = await client.query(
        'SELECT * FROM analysis_results WHERE job_id = $1',
        [jobId]
      );

      let resultRecord: AnalysisResultRecord;

      if (existingRes.rows.length > 0) {
        resultRecord = existingRes.rows[0];
      } else {
        const insertRes = await client.query(
          `INSERT INTO analysis_results
           (job_id, dataset_version_id, analysis_version, overall_quality_score, dimensions, summary, profiling, quality_checks, outliers, recommendations)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, job_id, dataset_version_id, analysis_version, overall_quality_score, dimensions, summary, profiling, quality_checks, outliers, recommendations, created_at`,
          [
            jobId,
            job.dataset_version_id,
            report.analysis_version || '1.0.0',
            report.score.overall,
            JSON.stringify(report.score.dimensions),
            JSON.stringify(report.summary),
            JSON.stringify(report.columns),
            JSON.stringify(report.quality_issues),
            JSON.stringify(report.outliers),
            JSON.stringify(report.recommendations),
          ]
        );
        resultRecord = insertRes.rows[0];
      }

      await client.query('COMMIT');
      logger.info(`Job ${jobId} marked COMPLETED with result ${resultRecord.id}`);
      return resultRecord;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async handleJobFailure(jobId: string, errorMessage: string): Promise<void> {
    await pool.query(
      `UPDATE analysis_jobs
       SET status = 'FAILED', error_message = $1, completed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [errorMessage, jobId]
    );
    logger.warn(`Job ${jobId} marked FAILED: ${errorMessage}`);
  }

  async getJobStatus(jobId: string): Promise<AnalysisJob | null> {
    const res = await pool.query(
      `SELECT id, dataset_version_id, status, error_message, started_at, completed_at, created_at, updated_at
       FROM analysis_jobs
       WHERE id = $1`,
      [jobId]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  async getAnalysisResultByJobId(jobId: string): Promise<AnalysisResultRecord | null> {
    const res = await pool.query(
      `SELECT id, job_id, dataset_version_id, analysis_version, overall_quality_score,
              dimensions, summary, profiling, quality_checks, outliers, recommendations, created_at
       FROM analysis_results
       WHERE job_id = $1`,
      [jobId]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  async getLatestAnalysisForVersion(versionId: string): Promise<AnalysisResultRecord | null> {
    const res = await pool.query(
      `SELECT id, job_id, dataset_version_id, analysis_version, overall_quality_score,
              dimensions, summary, profiling, quality_checks, outliers, recommendations, created_at
       FROM analysis_results
       WHERE dataset_version_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [versionId]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  }
}

export const analysisService = new AnalysisService();

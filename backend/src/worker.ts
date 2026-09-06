import fs from 'fs';
import { Worker, Job, UnrecoverableError } from 'bullmq';
import { config } from './config';
import { pool } from './services/db';
import { datasetService } from './services/datasetService';
import { analysisService } from './services/analysisService';
import { queueConnection, ANALYSIS_QUEUE_NAME } from './services/queueService';
import logger from './utils/logger';

export interface AnalysisJobData {
  jobId: string;
  versionId: string;
}

logger.info(`Starting DataLens Dedicated BullMQ Worker process...`);

export const worker = new Worker<AnalysisJobData>(
  ANALYSIS_QUEUE_NAME,
  async (job: Job<AnalysisJobData>) => {
    const { jobId, versionId } = job.data;
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts || 3;

    logger.info(`Worker processing job ${jobId} (Attempt ${attempt}/${maxAttempts})`, {
      jobId,
      versionId,
    });

    // 1. Validate version and file existence
    const version = await datasetService.getDatasetVersionById(versionId);
    if (!version) {
      const msg = `Dataset version '${versionId}' not found`;
      logger.error(msg, { jobId, versionId });
      await analysisService.handleJobFailure(jobId, msg);
      throw new UnrecoverableError(msg);
    }

    if (!fs.existsSync(version.storage_path)) {
      const msg = `Stored dataset file missing on disk: ${version.storage_path}`;
      logger.error(msg, { jobId, versionId });
      await analysisService.handleJobFailure(jobId, msg);
      throw new UnrecoverableError(msg);
    }

    // 2. Mark job as PROCESSING in PostgreSQL
    await pool.query(
      `UPDATE analysis_jobs
       SET status = 'PROCESSING', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
       WHERE id = $1`,
      [jobId]
    );

    // 3. Perform synchronous HTTP analysis call to Python Data Engine
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      logger.info(`Worker requesting analysis from Python Data Engine at ${config.dataEngineUrl}/analyze`, { jobId });

      const res = await fetch(`${config.dataEngineUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          file_path: version.storage_path,
          stored_filename: version.stored_filename,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorBody = (await res.json().catch(() => ({}))) as any;
        const msg = errorBody.message || `Data Engine responded with HTTP ${res.status}`;

        // 4xx errors are non-retryable (corrupted file, bad syntax, invalid payload)
        if (res.status >= 400 && res.status < 500) {
          logger.error(`Non-retryable data engine error for job ${jobId}: ${msg}`);
          await analysisService.handleJobFailure(jobId, msg);
          throw new UnrecoverableError(msg);
        }

        // 5xx errors are retryable
        throw new Error(msg);
      }

      const responseData = (await res.json()) as any;
      const report = responseData.report || responseData.results;

      if (!report || !report.score) {
        const msg = 'Invalid or malformed analysis report structure received from engine';
        logger.error(msg, { jobId });
        await analysisService.handleJobFailure(jobId, msg);
        throw new UnrecoverableError(msg);
      }

      // 4. Idempotently insert analysis_results and set status COMPLETED
      await analysisService.handleJobSuccess(jobId, report);
      logger.info(`Worker successfully completed analysis job ${jobId}`);

    } catch (err: any) {
      if (err instanceof UnrecoverableError) {
        throw err;
      }

      logger.warn(`Retryable failure on job ${jobId} (attempt ${attempt}/${maxAttempts}): ${err.message}`);

      // Update retry count and last error in PostgreSQL
      await pool.query(
        `UPDATE analysis_jobs
         SET retry_count = $1, last_error = $2, updated_at = NOW()
         WHERE id = $3`,
        [attempt, err.message, jobId]
      );

      // If all retries exhausted, mark FAILED in DB
      if (attempt >= maxAttempts) {
        await analysisService.handleJobFailure(jobId, `Exhausted ${maxAttempts} attempts. Last error: ${err.message}`);
      }

      throw err;
    }
  },
  {
    connection: queueConnection,
    concurrency: 2,
  }
);

worker.on('completed', (job) => {
  logger.info(`BullMQ Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  logger.error(`BullMQ Job ${job?.id} failed permanently: ${err.message}`);
});

const shutdownWorker = async (signal: string) => {
  logger.info(`${signal} received. Shutting down BullMQ worker...`);
  await worker.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdownWorker('SIGTERM'));
process.on('SIGINT', () => shutdownWorker('SIGINT'));

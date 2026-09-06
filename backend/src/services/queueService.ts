import { Queue } from 'bullmq';
import { config } from '../config';
import logger from '../utils/logger';
import { pool } from './db';

export const queueConnection = {
  host: config.redis.host,
  port: config.redis.port,
};

export const ANALYSIS_QUEUE_NAME = 'analysis-queue';

let queueInstance: Queue | null = null;

export function getAnalysisQueue(): Queue {
  if (!queueInstance) {
    queueInstance = new Queue(ANALYSIS_QUEUE_NAME, {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400, count: 5000 },
      },
    });
  }
  return queueInstance;
}

export async function enqueueAnalysisJob(jobId: string, versionId: string): Promise<void> {
  logger.info(`Enqueueing job ${jobId} for version ${versionId} into BullMQ ${ANALYSIS_QUEUE_NAME}`);
  const queue = getAnalysisQueue();
  await queue.add(
    'analyze-dataset',
    { jobId, versionId },
    { jobId } // Unique job ID matching DB record
  );
}

export async function reconcileOrphanedJobs(): Promise<void> {
  try {
    const res = await pool.query(
      `SELECT id FROM analysis_jobs WHERE status = 'PROCESSING' AND updated_at < NOW() - INTERVAL '10 minutes'`
    );
    const queue = getAnalysisQueue();
    for (const row of res.rows) {
      const activeJob = await queue.getJob(row.id);
      if (!activeJob) {
        logger.warn(`Reconciling orphaned job ${row.id}: setting status FAILED`);
        await pool.query(
          `UPDATE analysis_jobs
           SET status = 'FAILED', error_message = 'Job execution timed out or worker process terminated', completed_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [row.id]
        );
      }
    }
  } catch (err: any) {
    logger.error('Error during orphaned job reconciliation', { error: err.message });
  }
}

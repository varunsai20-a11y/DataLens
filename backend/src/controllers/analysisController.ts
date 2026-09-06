import { Request, Response, NextFunction } from 'express';
import { analysisService } from '../services/analysisService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import logger from '../utils/logger';

export const runAnalysis = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const versionId = req.body.version_id || req.body.versionId;
    if (!versionId || typeof versionId !== 'string') {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'A valid "version_id" (UUID) must be provided in the request body.',
      });
    }

    const userId = req.user?.id;
    const { job } = await analysisService.createJob(versionId, userId);

    res.status(202).json({
      status: 'SUCCESS',
      job_id: job.id,
      job_status: job.status,
      dataset_version_id: versionId,
      message: 'Analysis job created and queued for processing.',
    });
  } catch (err: any) {
    if (err.message.includes('FORBIDDEN')) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: err.message,
      });
    }
    if (err.message === 'Dataset version not found') {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: err.message,
      });
    }
    if (err.message === 'Stored dataset file not found on disk') {
      return res.status(400).json({
        error: 'FILE_MISSING',
        message: err.message,
      });
    }
    next(err);
  }
};

export const retryJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { job_id } = req.params;
    const userId = req.user?.id;
    const { job } = await analysisService.retryJob(job_id, userId);

    res.status(200).json({
      status: 'SUCCESS',
      job_id: job.id,
      job_status: job.status,
      message: 'Analysis job reset and re-queued for processing.',
    });
  } catch (err: any) {
    if (err.message.includes('FORBIDDEN')) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: err.message,
      });
    }
    if (err.message === 'Job not found' || err.message === 'Dataset version not found') {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: err.message,
      });
    }
    next(err);
  }
};

export const handleEngineCallback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { job_id, status, results, error } = req.body;

    if (!job_id) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'job_id is required in callback payload.',
      });
    }

    logger.info(`Received callback for job ${job_id} with status: ${status}`);

    if (status === 'COMPLETED') {
      if (!results || !results.score) {
        await analysisService.handleJobFailure(job_id, 'Malformed results payload received from engine');
        return res.status(400).json({ error: 'INVALID_RESULTS', message: 'Missing analysis report in payload' });
      }
      await analysisService.handleJobSuccess(job_id, results);
    } else if (status === 'FAILED') {
      await analysisService.handleJobFailure(job_id, error || 'Analysis failed in data engine');
    } else {
      return res.status(400).json({ error: 'INVALID_STATUS', message: `Unknown callback status: ${status}` });
    }

    res.status(200).json({
      status: 'ACKNOWLEDGED',
      job_id,
    });
  } catch (err: any) {
    logger.error('Error handling engine callback', { error: err });
    next(err);
  }
};

export const getJobStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { job_id } = req.params;
    const job = await analysisService.getJobStatus(job_id);

    if (!job) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Analysis job with ID '${job_id}' not found.`,
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      job,
    });
  } catch (err: any) {
    next(err);
  }
};

export const getAnalysisResults = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { job_id } = req.params;
    const result = await analysisService.getAnalysisResultByJobId(job_id);

    if (!result) {
      const job = await analysisService.getJobStatus(job_id);
      if (!job) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: `Analysis job with ID '${job_id}' not found.`,
        });
      }

      if (job.status === 'PENDING' || job.status === 'PROCESSING') {
        return res.status(202).json({
          status: 'PENDING',
          message: `Analysis job is still ${job.status}.`,
          job,
        });
      }

      if (job.status === 'FAILED') {
        return res.status(400).json({
          error: 'ANALYSIS_FAILED',
          message: job.error_message || 'Analysis failed.',
          job,
        });
      }
    }

    res.status(200).json({
      status: 'SUCCESS',
      result,
    });
  } catch (err: any) {
    next(err);
  }
};

export const getVersionAnalysis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const result = await analysisService.getLatestAnalysisForVersion(versionId);

    if (!result) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `No analysis results found for dataset version '${versionId}'.`,
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      result,
    });
  } catch (err: any) {
    next(err);
  }
};

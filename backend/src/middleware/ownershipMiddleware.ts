import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import { pool } from '../services/db';
import logger from '../utils/logger';
import { auditService } from '../services/auditService';

/**
 * Middleware to enforce dataset ownership access control.
 * 
 * Verifies that the authenticated user (req.user.id) owns the target dataset.
 * Accepts dataset identifiers from:
 * - req.params.datasetId or req.params.id
 * - req.body.dataset_id or req.body.datasetId
 * - req.body.version_id or req.body.versionId or req.params.versionId (resolved via dataset_versions)
 * - req.params.job_id (resolved via analysis_jobs -> dataset_versions)
 * - req.params.comparison_id (resolved via version_comparisons)
 * 
 * HTTP Responses:
 * - 401 UNAUTHORIZED: Missing or invalid authentication
 * - 403 FORBIDDEN: Authenticated user does not own the dataset
 * - 404 NOT_FOUND: Dataset does not exist
 */
export const requireDatasetOwnership = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required. Missing user identity.',
      });
    }

    const userId = req.user.id;
    let datasetId: string | null = null;

    // 1. Direct datasetId or id in req.params or req.body
    if (req.params.datasetId) {
      datasetId = req.params.datasetId;
    } else if (req.params.id) {
      datasetId = req.params.id;
    } else if (req.body?.dataset_id || req.body?.datasetId) {
      datasetId = req.body.dataset_id || req.body.datasetId;
    }

    // 2. Version ID in req.params or req.body
    if (!datasetId) {
      const versionId = req.params.versionId || req.body?.version_id || req.body?.versionId;
      if (versionId && typeof versionId === 'string') {
        const verRes = await pool.query(
          `SELECT dataset_id FROM dataset_versions WHERE id = $1`,
          [versionId]
        );
        if (verRes.rows.length === 0) {
          return res.status(404).json({
            error: 'NOT_FOUND',
            message: `Dataset version '${versionId}' was not found.`,
          });
        }
        datasetId = verRes.rows[0].dataset_id;
      }
    }

    // 3. Job ID in req.params
    if (!datasetId && req.params.job_id) {
      const jobId = req.params.job_id;
      const jobRes = await pool.query(
        `SELECT v.dataset_id 
         FROM analysis_jobs j
         JOIN dataset_versions v ON j.dataset_version_id = v.id
         WHERE j.id = $1`,
        [jobId]
      );
      if (jobRes.rows.length === 0) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: `Analysis job '${jobId}' was not found.`,
        });
      }
      datasetId = jobRes.rows[0].dataset_id;
    }

    // 4. Comparison ID in req.params
    if (!datasetId && req.params.comparison_id) {
      const comparisonId = req.params.comparison_id;
      const compRes = await pool.query(
        `SELECT dataset_id FROM version_comparisons WHERE id = $1`,
        [comparisonId]
      );
      if (compRes.rows.length === 0) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: `Version comparison '${comparisonId}' was not found.`,
        });
      }
      datasetId = compRes.rows[0].dataset_id;
    }

    if (!datasetId) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'No dataset identifier supplied in request.',
      });
    }

    // 5. Query dataset ownership
    const dsRes = await pool.query(
      `SELECT user_id FROM datasets WHERE id = $1`,
      [datasetId]
    );

    if (dsRes.rows.length === 0) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Dataset with ID '${datasetId}' was not found.`,
      });
    }

    const ownerId = dsRes.rows[0].user_id;

    if (ownerId !== userId) {
      logger.warn(`Access denied: User ${userId} attempted to access dataset ${datasetId} owned by ${ownerId}`);

      auditService.logEvent({
        userId,
        action: 'ACCESS_DENIED',
        resourceType: 'DATASET',
        resourceId: datasetId,
        status: 'REJECTED',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.headers['x-request-id'] as string,
        metadata: { attempted_dataset_id: datasetId, actual_owner_id: ownerId },
      });

      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to access or modify this dataset.',
      });
    }

    // Ownership verified successfully
    next();
  } catch (err: any) {
    logger.error('Error in ownership middleware:', err);
    next(err);
  }
};

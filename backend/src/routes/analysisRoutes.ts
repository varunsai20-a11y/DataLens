import { Router } from 'express';
import {
  runAnalysis,
  retryJob,
  handleEngineCallback,
  getJobStatus,
  getAnalysisResults,
  getVersionAnalysis,
} from '../controllers/analysisController';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireDatasetOwnership } from '../middleware/ownershipMiddleware';
import { validateRequest } from '../middleware/validationMiddleware';
import {
  runAnalysisSchema,
  jobIdParamSchema,
  versionIdParamSchema,
} from '../middleware/schemas';
import { generalRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Engine callback is internal (worker -> server), does not require client JWT
router.post('/engine/callback', handleEngineCallback as any);

// Protect all client analysis routes with JWT auth and dataset ownership check
router.use(authenticateToken as any);

router.post('/run', generalRateLimiter as any, validateRequest(runAnalysisSchema) as any, requireDatasetOwnership as any, runAnalysis as any);
router.post('/jobs/:job_id/retry', generalRateLimiter as any, validateRequest(jobIdParamSchema) as any, requireDatasetOwnership as any, retryJob as any);
// Status endpoint is excluded from rate limiting so client polling is never blocked
router.get('/status/:job_id', validateRequest(jobIdParamSchema) as any, requireDatasetOwnership as any, getJobStatus as any);
router.get('/results/:job_id', validateRequest(jobIdParamSchema) as any, requireDatasetOwnership as any, getAnalysisResults as any);
router.get('/versions/:versionId/analysis', validateRequest(versionIdParamSchema) as any, requireDatasetOwnership as any, getVersionAnalysis as any);

export default router;

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

const router = Router();

// Engine callback is internal (worker -> server), does not require client JWT
router.post('/engine/callback', handleEngineCallback as any);

// Protect all client analysis routes with JWT auth and dataset ownership check
router.use(authenticateToken as any);

router.post('/run', requireDatasetOwnership as any, runAnalysis as any);
router.post('/jobs/:job_id/retry', requireDatasetOwnership as any, retryJob as any);
router.get('/status/:job_id', requireDatasetOwnership as any, getJobStatus as any);
router.get('/results/:job_id', requireDatasetOwnership as any, getAnalysisResults as any);
router.get('/versions/:versionId/analysis', requireDatasetOwnership as any, getVersionAnalysis as any);

export default router;

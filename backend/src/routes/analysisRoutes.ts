import { Router } from 'express';
import {
  runAnalysis,
  retryJob,
  handleEngineCallback,
  getJobStatus,
  getAnalysisResults,
  getVersionAnalysis,
} from '../controllers/analysisController';

const router = Router();

router.post('/run', runAnalysis);
router.post('/jobs/:job_id/retry', retryJob);
router.post('/engine/callback', handleEngineCallback);
router.get('/status/:job_id', getJobStatus);
router.get('/results/:job_id', getAnalysisResults);
router.get('/versions/:versionId/analysis', getVersionAnalysis);

export default router;

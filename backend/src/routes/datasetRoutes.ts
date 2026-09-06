import { Router } from 'express';
import {
  createDataset,
  listDatasets,
  getDataset,
  deleteDataset,
  uploadVersion,
  uploadMiddleware,
} from '../controllers/datasetController';
import {
  runComparison,
  getComparison,
  getSchemaDrift,
  getDistributionDrift,
} from '../controllers/comparisonController';
import { getDatasetHistory } from '../controllers/historyController';
import { getAIInterpretation } from '../controllers/aiController';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireDatasetOwnership } from '../middleware/ownershipMiddleware';
import { validateRequest } from '../middleware/validationMiddleware';
import {
  createDatasetSchema,
  datasetIdParamSchema,
  idParamSchema,
  comparisonParamSchema,
  runComparisonSchema,
  historyQuerySchema,
  aiInterpretationSchema,
} from '../middleware/schemas';
import { generalRateLimiter, aiRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Protect all dataset routes with JWT authentication
router.use(authenticateToken as any);

// Static/Prefixed Comparison Routes (must come before generic /:datasetId or /:id parameter routes)
router.get('/comparisons/:comparison_id', validateRequest(comparisonParamSchema) as any, requireDatasetOwnership as any, getComparison as any);
router.get('/comparisons/:comparison_id/schema-drift', validateRequest(comparisonParamSchema) as any, requireDatasetOwnership as any, getSchemaDrift as any);
router.get('/comparisons/:comparison_id/distribution-drift', validateRequest(comparisonParamSchema) as any, requireDatasetOwnership as any, getDistributionDrift as any);

// Dataset CRUD Routes
router.post('/', generalRateLimiter as any, validateRequest(createDatasetSchema) as any, createDataset as any);
router.get('/', listDatasets as any);
router.get('/:datasetId', validateRequest(datasetIdParamSchema) as any, requireDatasetOwnership as any, getDataset as any);
router.delete('/:datasetId', generalRateLimiter as any, validateRequest(datasetIdParamSchema) as any, requireDatasetOwnership as any, deleteDataset as any);
router.post('/:datasetId/upload', generalRateLimiter as any, uploadMiddleware.single('file'), validateRequest(datasetIdParamSchema) as any, requireDatasetOwnership as any, uploadVersion as any);
router.post('/:datasetId/versions', generalRateLimiter as any, uploadMiddleware.single('file'), validateRequest(datasetIdParamSchema) as any, requireDatasetOwnership as any, uploadVersion as any);

// Phase 3.2 Comparison & History Routes
router.post('/:id/compare', generalRateLimiter as any, validateRequest(runComparisonSchema) as any, requireDatasetOwnership as any, runComparison as any);
router.get('/:id/history', validateRequest(historyQuerySchema) as any, requireDatasetOwnership as any, getDatasetHistory as any);

// Phase 3.3 AI Interpretation Route (stricter AI rate limit)
router.post('/:id/ai-interpretation', aiRateLimiter as any, validateRequest(aiInterpretationSchema) as any, requireDatasetOwnership as any, getAIInterpretation as any);

export default router;

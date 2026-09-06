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

const router = Router();

// Protect all dataset routes with JWT authentication
router.use(authenticateToken as any);

router.post('/', createDataset as any);
router.get('/', listDatasets as any);
router.get('/:datasetId', requireDatasetOwnership as any, getDataset as any);
router.delete('/:datasetId', requireDatasetOwnership as any, deleteDataset as any);
router.post('/:datasetId/upload', uploadMiddleware.single('file'), requireDatasetOwnership as any, uploadVersion as any);
router.post('/:datasetId/versions', uploadMiddleware.single('file'), requireDatasetOwnership as any, uploadVersion as any);

// Phase 3.2 Comparison & History Routes
router.post('/:id/compare', requireDatasetOwnership as any, runComparison as any);
router.get('/:id/history', requireDatasetOwnership as any, getDatasetHistory as any);
router.get('/comparisons/:comparison_id', requireDatasetOwnership as any, getComparison as any);
router.get('/comparisons/:comparison_id/schema-drift', requireDatasetOwnership as any, getSchemaDrift as any);
router.get('/comparisons/:comparison_id/distribution-drift', requireDatasetOwnership as any, getDistributionDrift as any);

// Phase 3.3 AI Interpretation Route
router.post('/:id/ai-interpretation', requireDatasetOwnership as any, getAIInterpretation as any);

export default router;

import { Router } from 'express';
import {
  createDataset,
  listDatasets,
  getDataset,
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

const router = Router();

router.post('/', createDataset);
router.get('/', listDatasets);
router.get('/:datasetId', getDataset);
router.post('/:datasetId/upload', uploadMiddleware.single('file'), uploadVersion);
router.post('/:datasetId/versions', uploadMiddleware.single('file'), uploadVersion);

// Phase 3.2 Comparison & History Routes
router.post('/:id/compare', runComparison);
router.get('/:id/history', getDatasetHistory);
router.get('/comparisons/:comparison_id', getComparison);
router.get('/comparisons/:comparison_id/schema-drift', getSchemaDrift);
router.get('/comparisons/:comparison_id/distribution-drift', getDistributionDrift);

export default router;

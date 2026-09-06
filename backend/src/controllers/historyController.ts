import { Request, Response, NextFunction } from 'express';
import { qualityHistoryService } from '../services/qualityHistoryService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export const getDatasetHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id: datasetId } = req.params;
    const userId = req.user?.id;
    const history = await qualityHistoryService.getDatasetHistory(datasetId, userId);

    res.status(200).json({
      status: 'SUCCESS',
      dataset_id: datasetId,
      history,
    });
  } catch (err: any) {
    if (err.message.includes('FORBIDDEN')) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: err.message,
      });
    }
    next(err);
  }
};

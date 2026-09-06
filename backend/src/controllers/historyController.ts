import { Request, Response, NextFunction } from 'express';
import { qualityHistoryService } from '../services/qualityHistoryService';

export const getDatasetHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: datasetId } = req.params;
    const history = await qualityHistoryService.getDatasetHistory(datasetId);

    res.status(200).json({
      status: 'SUCCESS',
      dataset_id: datasetId,
      history,
    });
  } catch (err: any) {
    next(err);
  }
};

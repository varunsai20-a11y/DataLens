import { Request, Response, NextFunction } from 'express';
import { aiInterpretationService } from '../services/aiInterpretationService';
import logger from '../utils/logger';

export const getAIInterpretation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const versionId = req.body?.version_id || req.body?.versionId || (req.query.version_id as string);

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'A valid dataset ID (UUID) is required.',
      });
    }

    const interpretation = await aiInterpretationService.getOrGenerateInterpretation(id, versionId);

    res.status(200).json({
      status: 'SUCCESS',
      interpretation,
    });
  } catch (err: any) {
    if (err.message.includes('not found') || err.message.includes('No analysis result')) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: err.message,
      });
    }
    logger.error('Error generating AI interpretation:', err);
    next(err);
  }
};

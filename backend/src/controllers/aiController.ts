import { Request, Response, NextFunction } from 'express';
import { aiInterpretationService } from '../services/aiInterpretationService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import logger from '../utils/logger';

export const getAIInterpretation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const versionId = req.body?.version_id || req.body?.versionId || (req.query.version_id as string);
    const userId = req.user?.id;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'A valid dataset ID (UUID) is required.',
      });
    }

    const interpretation = await aiInterpretationService.getOrGenerateInterpretation(id, versionId, userId);

    res.status(200).json({
      status: 'SUCCESS',
      interpretation,
    });
  } catch (err: any) {
    if (err.message.includes('FORBIDDEN')) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: err.message,
      });
    }
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

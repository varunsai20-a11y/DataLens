import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { auditService } from '../services/auditService';

export const getAuditLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required.',
      });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    // Scope logs to authenticated user unless user has ADMIN role
    const userIdFilter = req.user.role === 'ADMIN' ? undefined : req.user.id;

    const { logs, total } = await auditService.getAuditLogs(userIdFilter, limit, offset);

    res.status(200).json({
      status: 'SUCCESS',
      total,
      limit,
      offset,
      logs,
    });
  } catch (err: any) {
    next(err);
  }
};

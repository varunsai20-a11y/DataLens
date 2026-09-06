import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken as any, getAuditLogs as any);

export default router;

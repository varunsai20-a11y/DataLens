import { Router } from 'express';
import { registerUser, loginUser, getMe } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validationMiddleware';
import { registerSchema, loginSchema } from '../middleware/schemas';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', authRateLimiter as any, validateRequest(registerSchema) as any, registerUser);
router.post('/login', authRateLimiter as any, validateRequest(loginSchema) as any, loginUser);
router.get('/me', authenticateToken, getMe);

export default router;

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Authorization header missing.',
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Format must be "Bearer <token>".',
    });
  }

  const token = parts[1];

  try {
    const payload = authService.verifyToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: err.message.includes('expired')
        ? 'Authentication token has expired. Please log in again.'
        : 'Invalid authentication token.',
    });
  }
};

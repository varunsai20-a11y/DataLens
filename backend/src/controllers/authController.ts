import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body;
    const { user, token } = await authService.register(email, password, name);

    res.status(201).json({
      status: 'SUCCESS',
      user,
      token,
    });
  } catch (err: any) {
    if (err.message.startsWith('INVALID_INPUT')) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: err.message.replace('INVALID_INPUT: ', ''),
      });
    }
    if (err.message.startsWith('EMAIL_EXISTS')) {
      return res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: err.message.replace('EMAIL_EXISTS: ', ''),
      });
    }
    next(err);
  }
};

export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.login(email, password);

    res.status(200).json({
      status: 'SUCCESS',
      user,
      token,
    });
  } catch (err: any) {
    if (err.message.startsWith('INVALID_CREDENTIALS')) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: err.message.replace('INVALID_CREDENTIALS: ', ''),
      });
    }
    next(err);
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required.',
      });
    }

    const user = await authService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'User account not found.',
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      user,
    });
  } catch (err: any) {
    next(err);
  }
};

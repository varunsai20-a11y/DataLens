import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import logger from '../utils/logger';

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}

export class ErrorHandler extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (err instanceof multer.MulterError) {
    statusCode = 400;
    message = `File upload error: ${err.message}`;
  } else if (err.message && err.message.startsWith('INVALID_FILE_TYPE')) {
    statusCode = 400;
  }

  logger.error(`${statusCode} - ${message} - ${req.method} ${req.path}`, {
    requestId: req.headers['x-request-id'],
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST',
    message,
    requestId: req.headers['x-request-id'],
  });
};

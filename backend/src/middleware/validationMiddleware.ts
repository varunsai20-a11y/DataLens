import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import logger from '../utils/logger';

export interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export const validateRequest = (schemas: ValidationSchemas) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        const parsedParams = await schemas.params.parseAsync(req.params);
        req.params = parsedParams as any;
      }
      if (schemas.query) {
        const parsedQuery = await schemas.query.parseAsync(req.query);
        req.query = parsedQuery as any;
      }
      if (schemas.body) {
        const parsedBody = await schemas.body.parseAsync(req.body);
        req.body = parsedBody as any;
      }
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const firstIssue = err.issues[0];
        const fieldPath = firstIssue?.path?.join('.');
        const message = firstIssue
          ? `${fieldPath ? fieldPath + ': ' : ''}${firstIssue.message}`
          : 'Validation failed';

        logger.warn(`Validation failed on ${req.method} ${req.path}: ${message}`);

        return res.status(400).json({
          error: 'INVALID_INPUT',
          message,
          requestId: req.headers['x-request-id'],
        });
      }
      next(err);
    }
  };
};

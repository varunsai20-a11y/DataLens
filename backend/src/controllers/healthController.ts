import { Request, Response } from 'express';
import { checkDbConnection } from '../services/db';
import { checkRedisConnection } from '../services/redis';

export const healthCheck = async (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP' });
};

export const readyCheck = async (req: Request, res: Response) => {
  const dbOk = await checkDbConnection();
  const redisOk = await checkRedisConnection();

  if (dbOk && redisOk) {
    res.status(200).json({
      status: 'READY',
      dependencies: {
        postgres: 'OK',
        redis: 'OK',
      },
    });
  } else {
    res.status(503).json({
      status: 'NOT_READY',
      dependencies: {
        postgres: dbOk ? 'OK' : 'FAIL',
        redis: redisOk ? 'OK' : 'FAIL',
      },
    });
  }
};

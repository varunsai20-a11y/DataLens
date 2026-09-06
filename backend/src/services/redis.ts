import { createClient } from 'redis';
import { config } from '../config';
import logger from '../utils/logger';

export const redisClient = createClient({
  url: `redis://${config.redis.host}:${config.redis.port}`,
});

redisClient.on('error', (err) => logger.error('Redis Client Error', { error: err }));

export const connectRedis = async (): Promise<boolean> => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    logger.info('Successfully connected to Redis');
    return true;
  } catch (err) {
    logger.error('Redis connection failed', { error: err });
    return false;
  }
};

export const checkRedisConnection = async (): Promise<boolean> => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch (err) {
    logger.error('Redis ping failed', { error: err });
    return false;
  }
};

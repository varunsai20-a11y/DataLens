import app from './app';
import { config } from './config';
import logger from './utils/logger';
import { pool } from './services/db';
import { redisClient, connectRedis } from './services/redis';
import { runMigrations } from './db/migrator';

let server: any = null;

async function startServer() {
  try {
    await connectRedis();
  } catch (err) {
    logger.error('Initial Redis connection failed', { error: err });
  }

  try {
    await runMigrations();
    logger.info('Database schema verified and up to date.');
  } catch (err) {
    logger.error('Database migration failed on startup', { error: err });
  }

  server = app.listen(config.port, () => {
    logger.info(`Backend server running on port ${config.port} in ${config.env} mode`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      await pool.end();
      logger.info('PostgreSQL pool closed.');
      if (redisClient.isOpen) {
        await redisClient.quit();
      }
      logger.info('Redis connection closed.');
      process.exit(0);
    });
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;

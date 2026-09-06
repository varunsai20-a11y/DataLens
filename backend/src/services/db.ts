import { Pool } from 'pg';
import { config } from '../config';
import logger from '../utils/logger';

export const pool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
});

export const checkDbConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    logger.info('Successfully connected to PostgreSQL');
    client.release();
    return true;
  } catch (err) {
    logger.error('PostgreSQL connection failed', { error: err });
    return false;
  }
};

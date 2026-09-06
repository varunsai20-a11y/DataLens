import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 8080,
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  storagePath: process.env.STORAGE_PATH || '/app/storage',
  dataEngineUrl: process.env.DATA_ENGINE_URL || 'http://data-engine:5000',
  maxUploadSizeBytes: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '100', 10) * 1024 * 1024,
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    database: process.env.POSTGRES_DB || 'sentinelflow',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
};

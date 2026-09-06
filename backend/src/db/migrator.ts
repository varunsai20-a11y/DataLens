import fs from 'fs';
import path from 'path';
import { pool } from '../services/db';
import logger from '../utils/logger';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Get already applied migrations
    const res = await client.query('SELECT version FROM schema_migrations');
    const applied = new Set(res.rows.map((row: { version: string }) => row.version));

    // Candidate directories
    const candidateDirs = [
      path.join(__dirname, 'migrations'),
      path.join(__dirname, '../db/migrations'),
      path.join(process.cwd(), 'src', 'db', 'migrations'),
      path.join(process.cwd(), 'dist', 'db', 'migrations'),
      path.join(__dirname, '../../src/db/migrations'),
    ];

    let migrationsDir: string | null = null;
    for (const dir of candidateDirs) {
      if (fs.existsSync(dir)) {
        migrationsDir = dir;
        break;
      }
    }

    if (!migrationsDir) {
      logger.warn('Migrations directory not found in any candidate path');
      await client.query('COMMIT');
      return;
    }

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (!applied.has(file)) {
        logger.info(`Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        logger.info(`Successfully applied migration: ${file}`);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Migration failed, rolled back', { error });
    throw error;
  } finally {
    client.release();
  }
}

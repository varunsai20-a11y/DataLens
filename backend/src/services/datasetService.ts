import { pool } from './db';
import logger from '../utils/logger';

export interface Dataset {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  version_count?: number;
  latest_version?: number;
}

export interface DatasetVersion {
  id: string;
  dataset_id: string;
  version_number: number;
  original_filename: string;
  stored_filename: string;
  storage_path: string;
  checksum: string;
  file_size_bytes: number;
  mime_type: string | null;
  created_at: string;
}

function mapVersionRow(row: any): DatasetVersion {
  return {
    id: row.id,
    dataset_id: row.dataset_id,
    version_number: Number(row.version_number),
    original_filename: row.original_filename,
    stored_filename: row.stored_filename,
    storage_path: row.storage_path,
    checksum: row.checksum,
    file_size_bytes: Number(row.file_size_bytes),
    mime_type: row.mime_type,
    created_at: row.created_at,
  };
}

export class DatasetService {
  async createDataset(name: string, description?: string): Promise<Dataset> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Dataset name is required');
    }

    const res = await pool.query(
      `INSERT INTO datasets (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, created_at, updated_at`,
      [trimmedName, description ? description.trim() : null]
    );

    logger.info(`Created dataset: ${res.rows[0].id} (${trimmedName})`);
    return res.rows[0];
  }

  async listDatasets(): Promise<Dataset[]> {
    const res = await pool.query(
      `SELECT d.id, d.name, d.description, d.created_at, d.updated_at,
              COUNT(v.id)::int as version_count,
              MAX(v.version_number)::int as latest_version
       FROM datasets d
       LEFT JOIN dataset_versions v ON d.id = v.dataset_id
       GROUP BY d.id
       ORDER BY d.updated_at DESC`
    );
    return res.rows;
  }

  async getDatasetById(id: string): Promise<{ dataset: Dataset; versions: DatasetVersion[] } | null> {
    const datasetRes = await pool.query(
      `SELECT id, name, description, created_at, updated_at
       FROM datasets
       WHERE id = $1`,
      [id]
    );

    if (datasetRes.rows.length === 0) {
      return null;
    }

    const versionsRes = await pool.query(
      `SELECT id, dataset_id, version_number, original_filename, stored_filename, storage_path,
              checksum, file_size_bytes, mime_type, created_at
       FROM dataset_versions
       WHERE dataset_id = $1
       ORDER BY version_number DESC`,
      [id]
    );

    return {
      dataset: datasetRes.rows[0],
      versions: versionsRes.rows.map(mapVersionRow),
    };
  }

  async createDatasetVersion(
    datasetId: string,
    originalFilename: string,
    storedFilename: string,
    storagePath: string,
    checksum: string,
    fileSizeBytes: number,
    mimeType?: string
  ): Promise<DatasetVersion> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify dataset exists
      const checkRes = await client.query('SELECT id FROM datasets WHERE id = $1 FOR UPDATE', [datasetId]);
      if (checkRes.rows.length === 0) {
        throw new Error('Dataset not found');
      }

      // Get next version number
      const verRes = await client.query(
        'SELECT COALESCE(MAX(version_number), 0) + 1 AS next_ver FROM dataset_versions WHERE dataset_id = $1',
        [datasetId]
      );
      const nextVersion = verRes.rows[0].next_ver;

      // Insert dataset version
      const insertRes = await client.query(
        `INSERT INTO dataset_versions
         (dataset_id, version_number, original_filename, stored_filename, storage_path, checksum, file_size_bytes, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, dataset_id, version_number, original_filename, stored_filename, storage_path, checksum, file_size_bytes, mime_type, created_at`,
        [datasetId, nextVersion, originalFilename, storedFilename, storagePath, checksum, fileSizeBytes, mimeType || 'text/csv']
      );

      // Update dataset updated_at
      await client.query('UPDATE datasets SET updated_at = NOW() WHERE id = $1', [datasetId]);

      await client.query('COMMIT');
      logger.info(`Created version ${nextVersion} for dataset ${datasetId}`);
      return mapVersionRow(insertRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getDatasetVersionById(versionId: string): Promise<DatasetVersion | null> {
    const res = await pool.query(
      `SELECT id, dataset_id, version_number, original_filename, stored_filename, storage_path,
              checksum, file_size_bytes, mime_type, created_at
       FROM dataset_versions
       WHERE id = $1`,
      [versionId]
    );

    return res.rows.length > 0 ? mapVersionRow(res.rows[0]) : null;
  }
}

export const datasetService = new DatasetService();

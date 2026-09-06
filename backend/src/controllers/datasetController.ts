import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { datasetService } from '../services/datasetService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import logger from '../utils/logger';
import { sanitizeFilename, isPathInsideDir, validateFileContent } from '../utils/fileValidation';
import { auditService } from '../services/auditService';

// Ensure storage directory exists
if (!fs.existsSync(config.storagePath)) {
  fs.mkdirSync(config.storagePath, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = config.storagePath;
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const storedName = `${uuidv4()}${ext}`;
    cb(null, storedName);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: config.maxUploadSizeBytes,
  },
  fileFilter: (req, file, cb) => {
    const cleanName = sanitizeFilename(file.originalname);
    file.originalname = cleanName;
    const ext = path.extname(cleanName).toLowerCase();
    if (!['.csv', '.parquet', '.pq'].includes(ext)) {
      return cb(new Error('INVALID_FILE_TYPE: Only CSV (.csv) and Parquet (.parquet) files are supported.'));
    }
    cb(null, true);
  },
});

function calculateSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

export const createDataset = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Dataset name is required and cannot be empty.',
      });
    }

    if (name.length > 255) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Dataset name must be at most 255 characters.',
      });
    }

    const userId = req.user?.id;
    const dataset = await datasetService.createDataset(name, description, userId);

    auditService.logEvent({
      userId,
      action: 'DATASET_CREATE_SUCCESS',
      resourceType: 'DATASET',
      resourceId: dataset.id,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.headers['x-request-id'] as string,
      metadata: { name: dataset.name },
    });

    res.status(201).json({
      status: 'SUCCESS',
      dataset,
    });
  } catch (err: any) {
    next(err);
  }
};

export const listDatasets = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const datasets = await datasetService.listDatasets(userId);
    res.status(200).json({
      status: 'SUCCESS',
      datasets,
    });
  } catch (err: any) {
    next(err);
  }
};

export const getDataset = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const datasetId = req.params.datasetId || req.params.id;
    const userId = req.user?.id;
    const result = await datasetService.getDatasetById(datasetId, userId);

    if (!result) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Dataset with ID '${datasetId}' was not found.`,
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      dataset: result.dataset,
      versions: result.versions,
    });
  } catch (err: any) {
    next(err);
  }
};

export const deleteDataset = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const datasetId = req.params.datasetId || req.params.id;
    const userId = req.user?.id;

    const deleted = await datasetService.deleteDataset(datasetId, userId);
    if (!deleted) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Dataset with ID '${datasetId}' was not found.`,
      });
    }

    auditService.logEvent({
      userId,
      action: 'DATASET_DELETE_SUCCESS',
      resourceType: 'DATASET',
      resourceId: datasetId,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.headers['x-request-id'] as string,
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: `Dataset '${datasetId}' deleted successfully.`,
    });
  } catch (err: any) {
    next(err);
  }
};

export const uploadVersion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const file = req.file;
  const datasetId = req.params.datasetId || req.params.id;
  const userId = req.user?.id;

  if (!file) {
    return res.status(400).json({
      error: 'MISSING_FILE',
      message: 'A valid CSV file must be provided under the "file" field.',
    });
  }

  const filePath = file.path;

  try {
    // 1. Verify storage path is strictly inside configured storage directory
    if (!isPathInsideDir(filePath, config.storagePath)) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({
        error: 'INVALID_PATH',
        message: 'Uploaded file storage path is invalid.',
      });
    }

    // 2. Verify file size > 0
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({
        error: 'EMPTY_FILE',
        message: 'The uploaded dataset file is empty (0 bytes).',
      });
    }

    // 3. Content signature & magic byte validation
    const ext = path.extname(file.originalname).toLowerCase();
    const contentCheck = validateFileContent(filePath, ext, stats.size);
    if (!contentCheck.valid) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({
        error: 'INVALID_FILE_CONTENT',
        message: contentCheck.reason || 'Invalid file content.',
      });
    }

    // 4. Calculate SHA-256 checksum
    const checksum = await calculateSha256(filePath);

    // 5. Register version in DB
    const cleanOriginalName = sanitizeFilename(file.originalname);
    const mimeType = file.mimetype || (ext === '.csv' ? 'text/csv' : 'application/x-parquet');

    const version = await datasetService.createDatasetVersion(
      datasetId,
      cleanOriginalName,
      file.filename,
      filePath,
      checksum,
      stats.size,
      mimeType,
      userId
    );

    auditService.logEvent({
      userId,
      action: 'DATASET_UPLOAD_SUCCESS',
      resourceType: 'DATASET_VERSION',
      resourceId: version.id,
      status: 'SUCCESS',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.headers['x-request-id'] as string,
      metadata: { dataset_id: datasetId, filename: version.original_filename, size: version.file_size_bytes },
    });

    res.status(201).json({
      status: 'SUCCESS',
      version,
    });
  } catch (err: any) {
    // Prevent orphan files on failure
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logger.info(`Cleaned up orphan file after error: ${filePath}`);
      } catch (unlinkErr) {
        logger.error(`Failed to clean up file: ${filePath}`, { unlinkErr });
      }
    }

    if (err.message === 'Dataset not found') {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Dataset with ID '${datasetId}' was not found.`,
      });
    }

    next(err);
  }
};

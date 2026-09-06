import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { datasetService } from '../services/datasetService';
import logger from '../utils/logger';

// Ensure storage directory exists
if (!fs.existsSync(config.storagePath)) {
  fs.mkdirSync(config.storagePath, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.storagePath);
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
    const ext = path.extname(file.originalname).toLowerCase();
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

export const createDataset = async (req: Request, res: Response, next: NextFunction) => {
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

    const dataset = await datasetService.createDataset(name, description);
    res.status(201).json({
      status: 'SUCCESS',
      dataset,
    });
  } catch (err: any) {
    next(err);
  }
};

export const listDatasets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const datasets = await datasetService.listDatasets();
    res.status(200).json({
      status: 'SUCCESS',
      datasets,
    });
  } catch (err: any) {
    next(err);
  }
};

export const getDataset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { datasetId } = req.params;
    const result = await datasetService.getDatasetById(datasetId);

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

export const uploadVersion = async (req: Request, res: Response, next: NextFunction) => {
  const file = req.file;
  const { datasetId } = req.params;

  if (!file) {
    return res.status(400).json({
      error: 'MISSING_FILE',
      message: 'A valid CSV file must be provided under the "file" field.',
    });
  }

  const filePath = file.path;

  try {
    // 1. Verify file size > 0
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      fs.unlinkSync(filePath); // Clean up
      return res.status(400).json({
        error: 'EMPTY_FILE',
        message: 'The uploaded CSV file is empty.',
      });
    }

    // 2. Calculate SHA-256 checksum
    const checksum = await calculateSha256(filePath);

    // 3. Register version in DB
    const version = await datasetService.createDatasetVersion(
      datasetId,
      path.basename(file.originalname), // Sanitize original filename
      file.filename,
      filePath,
      checksum,
      stats.size,
      file.mimetype || 'text/csv'
    );

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

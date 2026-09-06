import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { requestIdMiddleware } from './middleware/requestId';
import { globalErrorHandler } from './middleware/errorHandler';
import { healthCheck, readyCheck } from './controllers/healthController';
import datasetRoutes from './routes/datasetRoutes';
import analysisRoutes from './routes/analysisRoutes';
import authRoutes from './routes/authRoutes';
import { handleEngineCallback, getVersionAnalysis } from './controllers/analysisController';

import { authenticateToken } from './middleware/authMiddleware';
import { requireDatasetOwnership } from './middleware/ownershipMiddleware';

const app = express();

app.use(helmet());
app.use(cors());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);

// Infrastructure endpoints
app.get('/api/health', healthCheck);
app.get('/api/ready', readyCheck);

// API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/datasets', datasetRoutes);

app.use('/api/v1/analysis', analysisRoutes);
app.post('/api/v1/engine/callback', handleEngineCallback);
app.get('/api/v1/dataset-versions/:versionId/analysis', authenticateToken as any, requireDatasetOwnership as any, getVersionAnalysis as any);

// Backward compatibility / convenience routes
app.get('/api/datasets', (req, res) => res.redirect(307, '/api/v1/datasets'));

// Error handler
app.use(globalErrorHandler);

export default app;

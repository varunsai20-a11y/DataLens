import { Request, Response, NextFunction } from 'express';
import { comparisonService } from '../services/comparisonService';

export const runComparison = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: datasetId } = req.params;
    const { base_version_id: baseVersionId, target_version_id: targetVersionId } = req.body;

    if (!baseVersionId || !targetVersionId) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Both base_version_id and target_version_id are required in request body.',
      });
    }

    const comparison = await comparisonService.compareVersions(datasetId, baseVersionId, targetVersionId);

    res.status(200).json({
      status: 'SUCCESS',
      comparison_id: comparison.id,
      comparison,
    });
  } catch (err: any) {
    if (err.message.includes('not found') || err.message.includes('missing')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: err.message });
    }
    if (err.message.includes('identical')) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: err.message });
    }
    next(err);
  }
};

export const getComparison = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { comparison_id } = req.params;
    const comparison = await comparisonService.getComparisonById(comparison_id);

    if (!comparison) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Version comparison with ID '${comparison_id}' not found.`,
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      comparison,
    });
  } catch (err: any) {
    next(err);
  }
};

export const getSchemaDrift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { comparison_id } = req.params;
    const comparison = await comparisonService.getComparisonById(comparison_id);

    if (!comparison) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Version comparison with ID '${comparison_id}' not found.`,
      });
    }

    const schemaDrift = comparison.comparison_result?.schema_drift || [];

    res.status(200).json({
      status: 'SUCCESS',
      comparison_id,
      schema_drift: schemaDrift,
    });
  } catch (err: any) {
    next(err);
  }
};

export const getDistributionDrift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { comparison_id } = req.params;
    const comparison = await comparisonService.getComparisonById(comparison_id);

    if (!comparison) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: `Version comparison with ID '${comparison_id}' not found.`,
      });
    }

    const distributionDrift = comparison.comparison_result?.distribution_drift || [];

    res.status(200).json({
      status: 'SUCCESS',
      comparison_id,
      distribution_drift: distributionDrift,
    });
  } catch (err: any) {
    next(err);
  }
};

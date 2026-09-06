import OpenAI from 'openai';
import { pool } from './db';
import { config } from '../config';
import { datasetService } from './datasetService';
import { analysisService, AnalysisResultRecord } from './analysisService';
import { comparisonService } from './comparisonService';
import logger from '../utils/logger';

export interface AIInterpretation {
  summary: string;
  key_findings: string[];
  likely_causes: string[];
  recommended_actions: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: 'OPENAI' | 'FALLBACK';
}

export class AIInterpretationService {
  private openaiClient: OpenAI | null = null;

  constructor() {
    if (config.openai.apiKey && config.openai.apiKey.trim().length > 0) {
      this.openaiClient = new OpenAI({ apiKey: config.openai.apiKey.trim() });
    }
  }

  /**
   * Build a compact, sanitized input object from deterministic findings.
   * STRICT PRIVACY GUARANTEE: Never includes raw CSV/Parquet rows, cell values, storage paths, or credentials.
   */
  public buildSanitizedInput(
    datasetName: string,
    versionNumber: number,
    analysisResult: AnalysisResultRecord,
    comparisonResult?: any
  ): any {
    const summary = typeof analysisResult.summary === 'string'
      ? JSON.parse(analysisResult.summary)
      : analysisResult.summary || {};

    const qualityChecks = typeof analysisResult.quality_checks === 'string'
      ? JSON.parse(analysisResult.quality_checks)
      : analysisResult.quality_checks || [];

    const compData = comparisonResult?.comparison_result || comparisonResult || {};
    const metricsSummary = compData.metrics_summary || {};
    const schemaDrift = compData.schema_drift || [];
    const distributionDrift = compData.distribution_drift || [];

    const intrinsicScore = Number(analysisResult.overall_quality_score);
    const driftImpactScore = metricsSummary.drift_impact_score ?? 100;
    const combinedHealthScore = metricsSummary.combined_health_score ?? intrinsicScore;
    const healthStatus = metricsSummary.health_status || (intrinsicScore >= 90 ? 'HEALTHY' : intrinsicScore >= 75 ? 'STABLE' : 'AT_RISK');

    // Filter top quality issues to sanitized summaries only
    const sanitizedQualityFindings = Array.isArray(qualityChecks)
      ? qualityChecks.slice(0, 5).map((q: any) => ({
          type: q.type || 'QUALITY_ISSUE',
          severity: q.severity || 'MEDIUM',
          column: q.column || null,
          message: q.message || '',
        }))
      : [];

    return {
      dataset_name: datasetName,
      version: versionNumber,
      overall_quality_score: intrinsicScore,
      intrinsic_quality_score: intrinsicScore,
      drift_impact_score: driftImpactScore,
      combined_health_score: combinedHealthScore,
      health_status: healthStatus,
      summary: {
        row_count: summary.row_count || 0,
        column_count: summary.column_count || 0,
        total_missing_percentage: summary.total_missing_percentage || 0,
      },
      schema_changes: schemaDrift.map((s: any) => ({
        column: s.column,
        change_type: s.change_type,
        base_type: s.base_type,
        target_type: s.target_type,
        severity: s.severity,
        message: s.message,
      })),
      distribution_drift: distributionDrift.map((d: any) => ({
        column: d.column,
        feature_type: d.feature_type,
        method: d.method,
        statistic: d.statistic,
        p_value: d.p_value,
        psi_score: d.psi_score,
        severity: d.severity,
        interpretation: d.interpretation,
      })),
      quality_findings: sanitizedQualityFindings,
    };
  }

  /**
   * Deterministic rule-based fallback generator.
   */
  public generateFallback(sanitizedInput: any): AIInterpretation {
    const keyFindings: string[] = [];
    const likelyCauses: string[] = [];
    const recommendedActions: string[] = [];

    const {
      health_status,
      combined_health_score,
      intrinsic_quality_score,
      schema_changes,
      distribution_drift,
      quality_findings,
    } = sanitizedInput;

    let highestSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    // 1. Evaluate Schema Changes
    if (Array.isArray(schema_changes) && schema_changes.length > 0) {
      for (const item of schema_changes) {
        if (item.change_type === 'REMOVED') {
          keyFindings.push(`Column '${item.column}' was removed in version ${sanitizedInput.version} (breaking schema change).`);
          likelyCauses.push(`Upstream pipeline transformation or source schema migration deleted column '${item.column}'.`);
          recommendedActions.push(`Inspect upstream producer pipeline to confirm if '${item.column}' deletion was intentional and update dependent downstream models.`);
          highestSeverity = 'CRITICAL';
        } else if (item.change_type === 'TYPE_CHANGED') {
          keyFindings.push(`Column '${item.column}' data type changed from ${item.base_type} to ${item.target_type}.`);
          likelyCauses.push(`Upstream source serialization shift or type coercion change in ingestion pipeline.`);
          recommendedActions.push(`Validate producer schema contracts and enforce type verification rules for '${item.column}'.`);
          if (highestSeverity !== 'CRITICAL') highestSeverity = 'HIGH';
        } else if (item.change_type === 'ADDED') {
          keyFindings.push(`New column '${item.column}' was added in version ${sanitizedInput.version}.`);
          recommendedActions.push(`Ensure downstream tables and ingestion schemas are updated to incorporate '${item.column}'.`);
        }
      }
    }

    // 2. Evaluate Distribution Drift
    if (Array.isArray(distribution_drift) && distribution_drift.length > 0) {
      for (const item of distribution_drift) {
        if (item.severity === 'SEVERE_DRIFT') {
          keyFindings.push(`Severe feature distribution drift detected in column '${item.column}' (${item.method}).`);
          likelyCauses.push(`Upstream population shift, feature drift, or fundamental change in data source behavior for '${item.column}'.`);
          recommendedActions.push(`Investigate root cause of distribution shift in '${item.column}' and evaluate whether downstream ML models require retraining.`);
          if (highestSeverity !== 'CRITICAL') highestSeverity = 'HIGH';
        } else if (item.severity === 'MODERATE_DRIFT') {
          keyFindings.push(`Moderate statistical drift observed in column '${item.column}' (stat: ${item.statistic}).`);
          likelyCauses.push(`Minor population fluctuation or emerging trend in source data for '${item.column}'.`);
          recommendedActions.push(`Monitor distribution metrics for '${item.column}' across subsequent dataset versions.`);
          if (highestSeverity === 'LOW') highestSeverity = 'MEDIUM';
        }
      }
    }

    // 3. Evaluate Intrinsic Quality & Findings
    if (Array.isArray(quality_findings) && quality_findings.length > 0) {
      for (const q of quality_findings) {
        keyFindings.push(`Quality issue: ${q.message}`);
        if (q.type?.includes('MISSING') || q.type?.includes('NULL')) {
          likelyCauses.push(`Incomplete data ingestion or upstream pipeline source null values.`);
          recommendedActions.push(`Audit source data completeness and check ingestion filters.`);
        }
        if (q.severity === 'CRITICAL') highestSeverity = 'CRITICAL';
        else if (q.severity === 'HIGH' && highestSeverity !== 'CRITICAL') highestSeverity = 'HIGH';
      }
    }

    // 4. Evaluate Overall Health Status
    if (['AT_RISK', 'DEGRADED', 'CRITICAL'].includes(health_status)) {
      keyFindings.push(`Combined Health Score is ${combined_health_score}/100 (Status: ${health_status}).`);
      likelyCauses.push(`Structural or distribution regression reduced version health despite intrinsic quality score of ${intrinsic_quality_score}.`);
      recommendedActions.push(`Perform complete end-to-end data audit before deploying version ${sanitizedInput.version} to production pipelines.`);
      if (health_status === 'CRITICAL') highestSeverity = 'CRITICAL';
      else if (health_status === 'DEGRADED' && highestSeverity !== 'CRITICAL') highestSeverity = 'HIGH';
      else if (health_status === 'AT_RISK' && highestSeverity === 'LOW') highestSeverity = 'MEDIUM';
    }

    // Default findings if clean
    if (keyFindings.length === 0) {
      keyFindings.push(`Dataset version ${sanitizedInput.version} maintains strong quality and structural stability.`);
      keyFindings.push(`Intrinsic Quality Score: ${intrinsic_quality_score}/100.`);
      likelyCauses.push(`Data ingestion and schema contracts are operating as expected.`);
      recommendedActions.push(`No immediate remediation required. Continue standard monitoring.`);
    }

    const summaryText = `DataLens evaluated dataset '${sanitizedInput.dataset_name}' (v${sanitizedInput.version}). Overall health status is ${health_status} with a combined health score of ${combined_health_score}/100. ${keyFindings[0]}`;

    return {
      summary: summaryText,
      key_findings: Array.from(new Set(keyFindings)),
      likely_causes: Array.from(new Set(likelyCauses)),
      recommended_actions: Array.from(new Set(recommendedActions)),
      severity: highestSeverity,
      source: 'FALLBACK',
    };
  }

  /**
   * Validate and parse AI structured response.
   */
  public validateInterpretation(data: any, source: 'OPENAI' | 'FALLBACK'): AIInterpretation {
    if (!data || typeof data !== 'object') {
      throw new Error('Interpretation result is not an object');
    }

    const summary = typeof data.summary === 'string' && data.summary.trim() ? data.summary.trim() : 'Data quality evaluation complete.';
    const key_findings = Array.isArray(data.key_findings) ? data.key_findings.map(String) : [];
    const likely_causes = Array.isArray(data.likely_causes) ? data.likely_causes.map(String) : [];
    const recommended_actions = Array.isArray(data.recommended_actions) ? data.recommended_actions.map(String) : [];
    
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(data.severity).toUpperCase())) {
      severity = String(data.severity).toUpperCase() as any;
    }

    return {
      summary,
      key_findings,
      likely_causes,
      recommended_actions,
      severity,
      source,
    };
  }

  /**
   * Call OpenAI Chat Completion API with JSON response format.
   */
  public async callOpenAI(sanitizedInput: any): Promise<AIInterpretation> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client is not configured (missing OPENAI_API_KEY).');
    }

    const systemPrompt = `You are DataLens AI, an expert data quality & reliability interpreter.
Your motto is: "Statistics determine what changed. AI explains what it means."
Analyze the provided compact data quality statistics and drift findings for the dataset version.
Generate a concise, professional explanation in strict JSON format matching this exact schema:
{
  "summary": "Short 2-3 sentence overall explanation.",
  "key_findings": ["Finding 1", "Finding 2"],
  "likely_causes": ["Possible cause 1", "Possible cause 2"],
  "recommended_actions": ["Action 1", "Action 2"],
  "severity": "LOW | MEDIUM | HIGH | CRITICAL"
}

STRICT CONSTRAINTS:
1. Base your explanation ONLY on the provided deterministic findings.
2. DO NOT invent missing columns, metrics, or drift that were not provided.
3. DO NOT reference raw dataset records or imaginary rows.
4. Keep key_findings, likely_causes, and recommended_actions concise and actionable.`;

    const userPrompt = JSON.stringify(sanitizedInput, null, 2);

    logger.info(`Sending sanitized input to OpenAI (${config.openai.model}) for dataset ${sanitizedInput.dataset_name} v${sanitizedInput.version}`);

    const response = await this.openaiClient.chat.completions.create({
      model: config.openai.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response content received from OpenAI API');
    }

    const parsed = JSON.parse(content);
    return this.validateInterpretation(parsed, 'OPENAI');
  }

  /**
   * Get existing AI interpretation or generate a new one (cached in analysis_results.ai_summary).
   */
  public async getOrGenerateInterpretation(datasetId: string, versionId?: string): Promise<AIInterpretation> {
    // 1. Fetch dataset & version info
    const datasetInfo = await datasetService.getDatasetById(datasetId);
    if (!datasetInfo) {
      throw new Error(`Dataset with ID '${datasetId}' was not found.`);
    }

    let targetVersion = datasetInfo.versions.find((v) => v.id === versionId);
    if (!targetVersion) {
      // Default to latest version if not specified or not found
      if (datasetInfo.versions.length === 0) {
        throw new Error(`No versions found for dataset '${datasetId}'.`);
      }
      targetVersion = datasetInfo.versions[datasetInfo.versions.length - 1];
    }

    // 2. Fetch analysis result for this target version
    const analysisResult = await analysisService.getLatestAnalysisForVersion(targetVersion.id);
    if (!analysisResult) {
      throw new Error(`No analysis result found for dataset version '${targetVersion.id}'. Please analyze the version first.`);
    }

    // 3. Check cached ai_summary in analysis_results
    const existingSummary = (analysisResult as any).ai_summary;
    if (existingSummary && typeof existingSummary === 'object' && existingSummary.summary) {
      logger.info(`Returning cached AI interpretation for dataset version ${targetVersion.id}`);
      return this.validateInterpretation(existingSummary, existingSummary.source || 'FALLBACK');
    }

    // 4. Fetch optional version comparison if base version exists
    let comparisonResult: any = null;
    if (targetVersion.version_number > 1) {
      const baseVersion = datasetInfo.versions.find((v) => v.version_number === targetVersion!.version_number - 1);
      if (baseVersion) {
        try {
          comparisonResult = await comparisonService.getComparisonByVersions(baseVersion.id, targetVersion.id);
        } catch (compErr) {
          logger.warn(`Could not fetch comparison for v${baseVersion.version_number} vs v${targetVersion.version_number}:`, compErr);
        }
      }
    }

    // 5. Build compact sanitized input
    const sanitizedInput = this.buildSanitizedInput(
      datasetInfo.dataset.name,
      targetVersion.version_number,
      analysisResult,
      comparisonResult
    );

    // 6. Generate interpretation via OpenAI or Fallback
    let interpretation: AIInterpretation;

    if (this.openaiClient) {
      try {
        interpretation = await this.callOpenAI(sanitizedInput);
      } catch (err: any) {
        logger.warn(`OpenAI call failed (${err.message}). Falling back to rule-based engine.`);
        interpretation = this.generateFallback(sanitizedInput);
      }
    } else {
      logger.info('OPENAI_API_KEY missing or empty. Using deterministic fallback engine.');
      interpretation = this.generateFallback(sanitizedInput);
    }

    // 7. Persist interpretation in analysis_results.ai_summary
    try {
      await pool.query(
        `UPDATE analysis_results SET ai_summary = $1 WHERE id = $2`,
        [JSON.stringify(interpretation), analysisResult.id]
      );
      logger.info(`Persisted ai_summary to analysis_results ${analysisResult.id}`);
    } catch (saveErr) {
      logger.error('Failed to persist ai_summary to analysis_results:', saveErr);
    }

    return interpretation;
  }
}

export const aiInterpretationService = new AIInterpretationService();

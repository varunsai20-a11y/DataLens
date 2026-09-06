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
  checksum: string;
  file_size_bytes: number;
  mime_type: string | null;
  created_at: string;
}

export interface AnalysisJob {
  id: string;
  dataset_version_id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScoreDimensions {
  completeness: number;
  validity: number;
  uniqueness: number;
  consistency: number;
  outlier_quality: number;
}

export interface DatasetSummary {
  row_count: number;
  column_count: number;
  duplicate_row_count: number;
  duplicate_row_percentage: number;
  total_cells: number;
  total_missing_cells: number;
  total_missing_percentage: number;
  memory_usage_bytes: number;
}

export interface ColumnProfile {
  name: string;
  dtype: string;
  inferred_type: string;
  total_count: number;
  missing_count: number;
  missing_percentage: number;
  unique_count: number;
  uniqueness_percentage: number;
  min?: number | null;
  max?: number | null;
  mean?: number | null;
  median?: number | null;
  std?: number | null;
  q1?: number | null;
  q3?: number | null;
  top_values?: Array<{ value: string; count: number; percentage: number }>;
}

export interface QualityIssue {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  column: string | null;
  affected_rows: number;
  affected_percentage: number;
  message: string;
  details?: Record<string, any>;
}

export interface OutlierReport {
  column: string;
  method: string;
  outlier_count: number;
  outlier_percentage: number;
  lower_bound: number;
  upper_bound: number;
  sample_outliers: number[];
}

export interface Recommendation {
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  column?: string | null;
  message: string;
  suggestion: string;
}

export interface AnalysisResult {
  id: string;
  job_id: string;
  dataset_version_id: string;
  analysis_version: string;
  overall_quality_score: number;
  dimensions: ScoreDimensions;
  summary: DatasetSummary;
  profiling: ColumnProfile[];
  quality_checks: QualityIssue[];
  outliers: OutlierReport[];
  recommendations: Recommendation[];
  created_at: string;
}

export interface SchemaDriftItem {
  column: string;
  change_type: 'ADDED' | 'REMOVED' | 'TYPE_CHANGED';
  base_type: string | null;
  target_type: string | null;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
}

export interface DistributionDriftItem {
  column: string;
  feature_type: 'numeric' | 'categorical';
  method: string;
  statistic: number;
  p_value: number | null;
  psi_score: number | null;
  severity: 'NO_DRIFT' | 'MODERATE_DRIFT' | 'SEVERE_DRIFT';
  sample_size_base: number;
  sample_size_target: number;
  interpretation: string;
}

export interface ComparisonMetricsSummary {
  base_row_count: number;
  target_row_count: number;
  row_count_delta: number;
  base_column_count: number;
  target_column_count: number;
  column_count_delta: number;
  base_quality_score: number;
  target_quality_score: number;
  quality_score_delta: number;
  base_missing_percentage: number;
  target_missing_percentage: number;
  missing_percentage_delta: number;
  intrinsic_quality_score?: number;
  drift_impact_score?: number;
  combined_health_score?: number;
  health_status?: string;
}

export interface VersionComparison {
  id: string;
  dataset_id: string;
  base_version_id: string;
  target_version_id: string;
  score_delta: number;
  comparison_result: {
    metrics_summary: ComparisonMetricsSummary;
    schema_drift: SchemaDriftItem[];
    distribution_drift: DistributionDriftItem[];
    intrinsic_quality_score?: number;
    drift_impact_score?: number;
    combined_health_score?: number;
    health_status?: string;
  };
  created_at: string;
}

export interface QualityHistoryItem {
  version_id: string;
  version_number: number;
  original_filename: string;
  created_at: string;
  overall_quality_score: number;
  intrinsic_quality_score?: number;
  drift_impact_score?: number;
  combined_health_score?: number;
  health_status?: string;
  dimensions: ScoreDimensions;
  summary: DatasetSummary;
  issue_count: number;
  anomaly_count: number;
}

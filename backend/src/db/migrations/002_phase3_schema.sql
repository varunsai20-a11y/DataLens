-- Migration 002: Phase 3 Schema Extensions

-- 1. Retry and failure tracking for analysis_jobs
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 3;
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP WITH TIME ZONE;

-- 2. Version comparison reports (for subsequent phase 3 checkpoints)
CREATE TABLE IF NOT EXISTS version_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    base_version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    target_version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    comparison_result JSONB NOT NULL,
    score_delta NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_version_comparison UNIQUE (base_version_id, target_version_id)
);

-- 3. Optional AI summary column on analysis_results
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS ai_summary JSONB;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_analysis_results_dataset_version ON analysis_results(dataset_version_id, created_at);
CREATE INDEX IF NOT EXISTS idx_version_comparisons_lookup ON version_comparisons(base_version_id, target_version_id);

-- Migration 001: Initial Schema for DataLens Phase 2

CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dataset_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dataset_version_number UNIQUE (dataset_id, version_number)
);

CREATE TABLE IF NOT EXISTS analysis_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID UNIQUE REFERENCES analysis_jobs(id) ON DELETE CASCADE,
    dataset_version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    analysis_version VARCHAR(50) NOT NULL,
    overall_quality_score NUMERIC(5, 2) NOT NULL,
    dimensions JSONB NOT NULL,
    summary JSONB NOT NULL,
    profiling JSONB NOT NULL,
    quality_checks JSONB NOT NULL,
    outliers JSONB NOT NULL,
    recommendations JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dataset_versions_dataset_id ON dataset_versions(dataset_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_version_id ON analysis_jobs(dataset_version_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_results_job_id ON analysis_results(job_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_version_id ON analysis_results(dataset_version_id);

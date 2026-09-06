-- File: docs/migrations/003_create_analysis_jobs.sql
CREATE TABLE IF NOT EXISTS analysis_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_dataset_version_id ON analysis_jobs(dataset_version_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
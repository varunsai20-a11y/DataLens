-- File: migrations/002_create_dataset_versions.sql
CREATE TABLE dataset_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    checksum TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    mime_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_dataset_versions_dataset_id ON dataset_versions(dataset_id);
CREATE INDEX idx_dataset_versions_version_number ON dataset_versions(version_number);
CREATE UNIQUE INDEX idx_dataset_versions_dataset_id_version ON dataset_versions(dataset_id, version_number);
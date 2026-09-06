# DataLens Database Specification

## 1. Data Model Overview
DataLens uses PostgreSQL for persistent storage of application metadata, dataset registration, job tracking, and finalized analysis results.

## 2. Entity Relationship Diagram (ERD)
```mermaid
erDiagram
    USER ||--o{ DATASET : owns
    DATASET ||--o{ DATASET_VERSION : has
    DATASET_VERSION ||--o{ ANALYSIS_JOB : triggers
    ANALYSIS_JOB ||--o| ANALYSIS_RESULT : produces
    
    USER {
        uuid id PK
        string username
        string email
        string password_hash
        timestamp created_at
    }
    
    DATASET {
        uuid id PK
        uuid owner_id FK
        string name
        string description
        timestamp created_at
        timestamp updated_at
    }
    
    DATASET_VERSION {
        uuid id PK
        uuid dataset_id FK
        string version_tag
        string storage_path
        string checksum
        float size_bytes
        timestamp created_at
    }
    
    ANALYSIS_JOB {
        uuid id PK
        uuid version_id FK
        string status "PENDING | PROCESSING | COMPLETED | FAILED"
        timestamp started_at
        timestamp completed_at
        string error_message
    }
    
    ANALYSIS_RESULT {
        uuid id PK
        uuid job_id FK
        float overall_quality_score
        jsonb profiling_data "Statistical summaries"
        jsonb quality_checks "Missingness, duplicates, etc."
        jsonb anomalies "Outliers, drift"
        jsonb recommendations "AI-generated suggestions"
        timestamp created_at
    }
```

## 3. Table Details

### 3.1 Users
- **Purpose**: Manage authentication and ownership.
- **Indexes**: `email` (Unique).

### 3.2 Datasets
- **Purpose**: Logical grouping of data files.
- **Indexes**: `owner_id`.

### 3.3 Dataset Versions
- **Purpose**: Track individual file uploads.
- **Indexes**: `dataset_id`.

### 3.4 Analysis Jobs
- **Purpose**: Track the lifecycle of a data quality scan.
- **Indexes**: `version_id`.

### 3.5 Analysis Results
- **Purpose**: Store the final output of the Python engine.
- **Indexes**: `job_id` (Unique).

## 4. Redis Responsibilities
Redis is used as a high-performance temporary store, not as a primary database.

- **Job Status Cache**: Maps `job_id` $\rightarrow$ `status` (e.g., `job:123:status` $\rightarrow$ `PROCESSING`). This allows the frontend to poll for status without hitting PostgreSQL on every request.
- **Rate Limiting**: Track request counts per user to prevent API abuse during file uploads.
- **Temporary State**: Store intermediate processing flags for the Python engine if required for multi-stage analysis.

## 5. Storage Strategy
- **Filesystem**: The actual dataset files (CSV/Parquet) are stored on a shared volume (accessible by both Node.js and Python).
- **Paths**: PostgreSQL stores the relative path to the file in `dataset_versions.storage_path`.

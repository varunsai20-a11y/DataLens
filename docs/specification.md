# DataLens System Specification - Master Summary

## 1. Problem Statement
DataLens addresses "silent data failure"—the phenomenon where data pipelines continue to run but produce corrupted or drifted data. It provides a deterministic, AI-enhanced platform for automated reliability checks.

## 2. Target Users
- **Data Engineers**: For pipeline health and regression detection.
- **Data Scientists**: For clean training sets and drift monitoring.
- **Analytics Managers**: For high-level quality scoring.
- **MLOps Engineers**: For implementing quality gates in ML pipelines.

## 3. Functional Requirements
- **MVP**: Dataset registration, versioning, statistical profiling, basic quality checks (missingness, duplicates, constant columns), overall quality scoring, and a React dashboard.
- **Production**: Statistical anomaly detection (Isolation Forest), drift detection (K-S test), side-by-side version comparison, and RBAC.
- **Future**: Database connectors (PostgreSQL, Snowflake), scheduled monitoring, and LLM-driven fix generation.

## 4. Non-Functional Requirements
- **Deterministic Metrics**: No LLM-based calculation for numerical metrics.
- **Asynchronous processing**: Non-blocking API for data analysis.
- **Modular Polyglot Stack**: Node.js (orchestration) + Python (data engine).
- **Security**: Zero-trust file upload strategy.

## 5. System Architecture
DataLens uses a decoupled architecture:
- **Frontend**: React dashboard for visualization and interaction.
- **Backend**: Node.js/Express API for orchestration, user management, and metadata.
- **Data Engine**: Python/Flask service for heavy statistical computation.
- **Persistence**: PostgreSQL for metadata and results.
- **State/Cache**: Redis for job status tracking and rate limiting.
- **Storage**: Shared filesystem volume for raw datasets.

### Request Flow
`User` $\rightarrow$ `React` $\rightarrow$ `Node.js` $\rightarrow$ `Shared Storage` $\rightarrow$ `Python Engine` $\rightarrow$ `Shared Storage` $\rightarrow$ `Node.js` $\rightarrow$ `PostgreSQL` $\rightarrow$ `React`.

## 6. Dataset & Job Lifecycle
- **Dataset**: Created $\rightarrow$ Version Uploaded $\rightarrow$ Analyzed $\rightarrow$ Scored.
- **Analysis Job**: `PENDING` $\rightarrow$ `PROCESSING` $\rightarrow$ `COMPLETED` | `FAILED`.

## 7. Data Model
- **PostgreSQL**: Users, Datasets, DatasetVersions, AnalysisJobs, AnalysisResults.
- **Redis**: `job:{id}:status`, rate limits.

## 8. Responsibilities
- **Node.js**: API Gateway, Job Scheduling, User Auth, Result Aggregation.
- **Python**: Profiling, Quality Analysis, Anomaly Detection, Scoring, AI Recommendations.
- **React**: Data Visualization, Upload Interface, Version Comparison.

## 9. REST API Design
- `/api/v1/datasets`: Management of datasets and versions.
- `/api/v1/analysis`: Job triggering, status polling, and result retrieval.
- Internal Endpoints: `/engine/analyze` (Backend $\rightarrow$ Engine) and `/engine/callback` (Engine $\rightarrow$ Backend).

## 10. Security & Performance
- **Security**: JWT Auth, UUID file renaming, isolated engine network, strict MIME validation.
- **Performance**: Vectorized Python operations, asynchronous jobs, Redis-backed status polling.

## 11. Testing & Observability
- **Testing**: Pytest/Jest unit tests, Integration tests for service boundaries, E2E workflow verification.
- **Observability**: Job lifecycle logging and memory profiling for the data engine.

## 12. Definition of DONE
- Features implemented $\rightarrow$ Tests pass $\rightarrow$ E2E workflow verified $\rightarrow$ Code linted $\rightarrow$ Docs updated.

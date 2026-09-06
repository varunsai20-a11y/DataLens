# DataLens Testing Specification

## 1. Testing Philosophy
DataLens prioritizes reliability over speed. Since this is a data quality platform, the platform itself must have impeccable data quality. Every feature must be verified via automated tests.

## 2. Testing Layers

### 2.1 Unit Testing
- **Node.js Backend**:
  - Test API request validation logic.
  - Test database service methods.
  - Test JWT generation and verification.
- **Python Engine**:
  - Test individual statistical functions (e.g., `calculate_missingness`).
  - Test outlier detection logic with known synthetic datasets.
  - Test quality score weighting logic.

### 2.2 Integration Testing
- **Service Boundaries**:
  - Test the REST call from Node.js $\rightarrow$ Python.
  - Test the callback from Python $\rightarrow$ Node.js.
- **Database Integrity**:
  - Test that `analysis_results` are correctly linked to `analysis_jobs`.
  - Verify that dataset versions are correctly tracked.

### 2.3 API Testing
- **Tooling**: Pytest or Jest (using `supertest`).
- **Coverage**:
  - Positive cases (valid uploads, valid analysis requests).
  - Negative cases (non-existent version IDs, malformed files).
  - Edge cases (empty files, files with only nulls).

### 2.4 End-to-End (E2E) Testing
- **Workflow**: 
  `User Upload` $\rightarrow$ `Registration` $\rightarrow$ `Analysis Trigger` $\rightarrow$ `Job Processing` $\rightarrow$ `Dashboard Display`.
- **Verification**: Use a known "dirty" dataset and verify that the platform detects the specific issues (e.g., 10% missingness in Column X).

## 3. Verification Matrix

| Feature | Unit Test | Integration Test | API Test | E2E Test |
|---|---|---|---|---|
| File Upload | $\square$ | $\square$ | $\checkmark$ | $\checkmark$ |
| Profiling | $\checkmark$ | $\square$ | $\square$ | $\checkmark$ |
| Anomaly Detection | $\checkmark$ | $\square$ | $\square$ | $\checkmark$ |
| Job Lifecycle | $\square$ | $\checkmark$ | $\checkmark$ | $\checkmark$ |
| Quality Scoring | $\checkmark$ | $\square$ | $\square$ | $\checkmark$ |

## 4. Performance Testing Strategy
- **Dataset Scale**: Test with datasets of 1k, 10k, 100k, and 1M rows.
- **Concurrency**: Simulate 5 simultaneous analysis jobs.
- **Metrics**:
  - Time to complete profiling for 1M rows.
  - Memory peak during anomaly detection.
  - API response time for polling status.

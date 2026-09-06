# DataLens API Specification

## 1. API Overview
DataLens provides a RESTful API implemented in Node.js. All endpoints return JSON.

### Base URL
`/api/v1`

## 2. Endpoints

### 2.1 Dataset Management
| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/datasets` | Register a new dataset | `{ "name": "...", "description": "..." }` | `201 Created` |
| `GET` | `/datasets` | List all user datasets | `None` | `200 OK` |
| `GET` | `/datasets/:id` | Get dataset metadata | `None` | `200 OK` |
| `POST` | `/datasets/:id/upload` | Upload new version | `Multipart/form-data` | `201 Created` |
| `GET` | `/datasets/:id/versions` | List versions | `None` | `200 OK` |

### 2.2 Analysis Job Management
| Method | Endpoint | Description | Request Body | `Response` |
|---|---|---|---|---|
| `POST` | `/analysis/run` | Trigger analysis on a version | `{ "version_id": "..." }` | `202 Accepted` |
| `GET` | `/analysis/status/:job_id` | Poll job status | `None` | `200 OK` |
| `GET` | `/analysis/results/:job_id` | Get analysis output | `None` | `200 OK` |
| `GET` | `/analysis/compare/:job1_id/:job2_id` | Compare two jobs | `None` | `200 OK` |

### 2.3 Internal Engine API (Node.js $\rightarrow$ Python)
| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/engine/analyze` | Request analysis | `{ "job_id": "...", "file_path": "..." }` | `202 Accepted` |

### 2.4 Internal Engine Callback (Python $\rightarrow$ Node.js)
| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/engine/callback` | Submit results | `{ "job_id": "...", "status": "...", "results": { ... }, "error": "..." }` | `200 OK` |

## 3. Request/Response Formats

### 3.1 Job Status Response
```json
{
  "job_id": "uuid",
  "status": "PROCESSING",
  "progress": 45,
  "estimated_time": "2m"
}
```

### 3.2 Analysis Result Response
```json
{
  "job_id": "uuid",
  "overall_quality_score": 84.5,
  "profiling": {
    "columns": {
      "age": { "type": "int", "mean": 34.2, "nulls": 12, "missing_pct": 0.01 },
      "income": { "type": "float", "mean": 54000, "nulls": 0, "missing_pct": 0 }
    }
  },
  "quality_checks": {
    "duplicate_rows": 142,
    "constant_columns": ["country"],
    "invalid_values": [
      { "column": "age", "count": 5, "reason": "negative_value" }
    ]
  },
  "anomalies": {
    "outliers": {
      "income": [ { "index": 450, "value": 1000000, "z_score": 12.4 } ]
    }
  },
  "recommendations": [
    { "issue": "High missingness in 'email'", "suggestion": "Impute with median or remove column if non-essential." }
  ]
}
```

## 4. Authentication
- **Strategy**: JWT (JSON Web Token) passed in `Authorization: Bearer <token>` header.
- **Scope**: Basic user-level access control.

## 5. Error Handling
- **Format**:
```json
{
  "error": "INVALID_INPUT",
  "message": "The provided version_id is not found.",
  "request_id": "uuid"
}
```

# DataLens

Automated data reliability, distribution drift, and quality platform.

## Quick Start

1. Copy `.env.example` to `.env`
2. Run `docker compose up --build`
3. Access the frontend at `http://localhost:3000`
4. Verify backend health at `http://localhost:8080/api/health`
5. Verify backend readiness at `http://localhost:8080/api/ready`
6. Verify data engine health at `http://localhost:5000/health`
7. Verify data engine readiness at `http://localhost:5000/ready`

Detailed verification steps are available in `infrastructure/VERIFICATION.md`.

## Phase 3.3: AI Interpretation & Recommendations

> **Architectural Principle**: *"Statistics determine what changed. AI explains what it means."*

DataLens integrates a lightweight, production-grade AI interpretation layer powered by OpenAI (`gpt-4o-mini`). The deterministic DataLens engine computes statistical metrics, schema drift, distribution drift (KS/PSI), and quality scores. The AI layer translates these findings into human-readable executive summaries, key findings, root causes, and recommended actions.

### Privacy & Data Safeguards
- **Zero Raw Data Transmission**: DataLens NEVER sends raw CSV/Parquet file contents, cell values, credentials, or arbitrary user records to external AI models.
- **Sanitized Metadata Payload**: Only pre-calculated summary metrics, health scores, schema drift items, distribution drift metrics, and quality issue types are sent.

### Environment Variables
```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

### Deterministic Fallback Engine
If `OPENAI_API_KEY` is not configured or an API request fails, DataLens automatically uses an internal rule-based deterministic fallback engine. The application continues running without interruption, and results are clearly tagged as `source: "FALLBACK"`.

### API Endpoint
`POST /api/v1/datasets/:id/ai-interpretation`

**Request Body (Optional):**
```json
{
  "version_id": "uuid-optional"
}
```

**Example Response:**
```json
{
  "status": "SUCCESS",
  "interpretation": {
    "summary": "DataLens evaluated dataset 'Sales Data' (v2). Overall health status is AT_RISK with a combined health score of 62/100.",
    "key_findings": [
      "Column 'customer_id' was removed in version 2 (breaking schema change).",
      "Severe feature distribution drift detected in column 'age' (Kolmogorov-Smirnov test)."
    ],
    "likely_causes": [
      "Upstream pipeline transformation or source schema migration deleted column 'customer_id'.",
      "Upstream population shift or change in data source behavior for 'age'."
    ],
    "recommended_actions": [
      "Inspect upstream producer pipeline to confirm if 'customer_id' deletion was intentional.",
      "Investigate root cause of distribution shift in 'age' and evaluate downstream ML retraining."
    ],
    "severity": "CRITICAL",
    "source": "OPENAI"
  }
}
```


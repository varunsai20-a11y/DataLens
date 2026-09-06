# DataLens — Production Deployment Runbook & Release Checklist

This document provides a step-by-step production deployment guide, operational runbook, rollback procedure, and release verification checklist for DataLens.

---

## 1. Pre-Deployment Setup

### 1.1 Prerequisites
- Node.js v20+ & `npm`
- Python 3.11+ & `pip`
- Docker Desktop v20+ / Docker Engine v24+ with Docker Compose v2
- PostgreSQL 15+ instance
- Redis 7+ instance

### 1.2 Environment Configuration
Copy the environment template file:

```bash
cp .env.example .env
```

Set the mandatory production secrets in `.env`:

```env
# Mandatory Production Security Keys
NODE_ENV=production
JWT_SECRET=generate_a_secure_random_64_character_hex_secret_here

# Database Configuration
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_db_password
POSTGRES_DB=sentinelflow

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Storage Path
STORAGE_PATH=/app/storage

# Python Data Engine
ENGINE_URL=http://data-engine:5000

# Optional OpenAI API Integration (Falls back to rule-based engine if empty)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Frontend Base API URL
VITE_API_URL=http://localhost:8080/api
```

---

## 2. Deployment Execution

### 2.1 Starting Full Stack with Docker Compose (Recommended)

Execute the production build and container initialization:

```bash
# 1. Build and launch containers in background
docker compose up --build -d

# 2. Verify all 6 microservices are running and healthy
docker compose ps
```

*Expected Service List*:
- `datalens-postgres` (PostgreSQL 15)
- `datalens-redis` (Redis 7)
- `datalens-engine` (Python Flask Data Engine)
- `datalens-backend` (Node.js Express API)
- `datalens-worker` (BullMQ Dedicated Background Worker)
- `datalens-frontend` (React + Vite SPA)

### 2.2 Database Initialization & Migrations
Database schema migrations run automatically on backend startup via [`migrator.ts`](file:///c:/Users/varun/OneDrive/Documents/personals/personal%20projects/DataLens/backend/src/db/migrator.ts).

If running manually without Docker:
```bash
cd backend
npm run build
node -e "require('./dist/db/migrator').runMigrations().then(() => console.log('Migrations succeeded')).catch(console.error)"
```

---

## 3. Post-Deployment Verification

### 3.1 Health & Readiness Probes

Verify all Liveness and Readiness probes return `200 OK`:

```bash
# Backend Liveness
curl -i http://localhost:8080/api/health
# Expected: HTTP 200 OK {"status":"UP"}

# Backend Readiness (Verifies Postgres + Redis connections)
curl -i http://localhost:8080/api/ready
# Expected: HTTP 200 OK {"status":"READY","dependencies":{"postgres":"OK","redis":"OK"}}

# Data Engine Liveness
curl -i http://localhost:5000/health
# Expected: HTTP 200 OK {"status":"UP","service":"data-engine"}

# Data Engine Readiness (Verifies Storage write access)
curl -i http://localhost:5000/ready
# Expected: HTTP 200 OK {"status":"READY","service":"data-engine"}
```

### 3.2 Background Worker Inspection
Monitor BullMQ job consumer logs:

```bash
docker compose logs -f worker
```

---

## 4. Safe Rollback Procedure

> [!WARNING]
> **Database Rollback Caution**: Schema migrations `001` through `004` alter core table structures (`users`, `datasets`, `audit_logs`). Do NOT execute raw `DROP TABLE` or `DOWN` SQL scripts in production without taking a database snapshot first.

In the event of a critical deployment failure:

1. **Stop Active Containers**:
   ```bash
   docker compose down
   ```
2. **Revert to Previous Docker Image Tag or Git Release Commit**:
   ```bash
   git checkout <previous_stable_release_tag>
   ```
3. **Redeploy Previous Build**:
   ```bash
   docker compose up --build -d
   ```
4. **Database Restoration** (if required): Restore database snapshot from pre-deployment backup volume.

---

## 5. Production Release Checklist

Use this checklist prior to authorizing a release:

- [ ] **Environment Configuration**: `.env` created from `.env.example` with non-default credentials.
- [ ] **JWT Secret**: `JWT_SECRET` generated with a strong 64-character secret.
- [ ] **Database Connection**: PostgreSQL instance accessible and `sentinelflow` database created.
- [ ] **Redis Connection**: Redis instance active on port `6379`.
- [ ] **Storage Permissions**: Dataset storage volume directory (`STORAGE_PATH`) exists and is writable.
- [ ] **Database Migrations**: Migrations `001` through `004` applied successfully.
- [ ] **Backend Health Probe**: `GET /api/health` returns `200 UP`.
- [ ] **Backend Readiness Probe**: `GET /api/ready` returns `200 READY`.
- [ ] **Data Engine Health Probe**: `GET /health` returns `200 UP`.
- [ ] **Data Engine Readiness Probe**: `GET /ready` returns `200 READY`.
- [ ] **Background Worker**: `datalens-worker` running without restart loops.
- [ ] **Frontend SPA**: UI accessible on port `3000`.
- [ ] **User Registration & Auth**: Account creation and JWT issuance functional.
- [ ] **Dataset Ingestion**: CSV/Parquet upload and magic byte validation functional.
- [ ] **Async Analysis Pipeline**: BullMQ job created, processed by worker, and results persisted.
- [ ] **AI Fallback**: Rule-based deterministic fallback executes when `OPENAI_API_KEY` is omitted.
- [ ] **Audit Logging**: Security events logged to `audit_logs` without leaking secrets.
- [ ] **Multi-Tenant Ownership**: Cross-tenant resource access blocked with `403 Forbidden`.
- [ ] **Automated Tests**: Backend security/reliability Jest suites (80/80 pass) and Pytest (20/20 unit pass).
- [ ] **Secret Hygiene**: Zero `.env` files, API keys, or JWT secrets committed to Git repository.

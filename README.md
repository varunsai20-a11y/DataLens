# DataLens

Automated data reliability, distribution drift, quality, and AI interpretation platform.

---

## Architecture Overview

DataLens consists of 5 core services:
1. **Frontend**: React + Vite + TypeScript Single Page Application (Port `3000`)
2. **Backend**: Node.js + Express + TypeScript API Server (Port `8080`)
3. **Queue Worker**: Node.js + BullMQ Background Processing Worker
4. **Data Engine**: Python + Flask Statistical Analysis & Drift Engine (Port `5000`)
5. **Infrastructure**: PostgreSQL 15 (Port `5432`) & Redis 7 (Port `6379`)

---

## 1. Prerequisites

- **Docker Desktop** (v20+ with Docker Compose v2) *or* local service binaries:
  - **Node.js**: v20+ and `npm`
  - **Python**: v3.11+ and `pip`
  - **PostgreSQL**: v15+
  - **Redis**: v7+

---

## 2. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### Key Environment Variables

| Variable | Description | Default / Example | Mandatory in Prod? |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` | Yes |
| `PORT` | Backend HTTP API port | `8080` | Yes |
| `POSTGRES_HOST` | PostgreSQL hostname | `localhost` (or `postgres` in Docker) | Yes |
| `POSTGRES_PORT` | PostgreSQL port | `5432` | Yes |
| `POSTGRES_USER` | Database user | `postgres` | Yes |
| `POSTGRES_PASSWORD` | Database password | `sentinel_pass` | Yes |
| `POSTGRES_DB` | Database name | `sentinelflow` | Yes |
| `REDIS_HOST` | Redis hostname | `localhost` (or `redis` in Docker) | Yes |
| `REDIS_PORT` | Redis port | `6379` | Yes |
| `JWT_SECRET` | Secret key for signing JWT tokens | *Random Secret Key* | **YES** |
| `STORAGE_PATH` | Path for dataset storage | `./storage` (or `/app/storage`) | Yes |
| `MAX_UPLOAD_SIZE_MB` | Maximum allowed file upload size (MB) | `100` | No |
| `ENGINE_URL` / `DATA_ENGINE_URL` | Python Data Engine base URL | `http://localhost:5000` (or `http://data-engine:5000`) | Yes |
| `OPENAI_API_KEY` | OpenAI API Key for AI Insights | *Optional (Falls back to deterministic engine)* | No |
| `OPENAI_MODEL` | OpenAI model identifier | `gpt-4o-mini` | No |
| `VITE_API_URL` | Frontend API base URL | `http://localhost:8080/api` | Yes |

*Note: Never commit real production credentials or `JWT_SECRET` keys to source control.*

---

## 3. Docker Workflow (Recommended)

To start the full stack using Docker Compose:

```bash
# Build and start all services in background
docker compose up --build -d

# Check status of running containers
docker compose ps

# View logs for all services (or specific service e.g. docker compose logs -f backend)
docker compose logs -f

# Stop services
docker compose down

# Stop services and purge data volumes
docker compose down -v
```

---

## 4. Local Development Workflow (Without Docker)

If running services individually outside Docker:

### Step 4a. Start PostgreSQL & Redis
Ensure local PostgreSQL (port `5432`) and Redis (port `6379`) instances are running and database `sentinelflow` is created.

### Step 4b. Database Migrations
Run automated schema migrations against PostgreSQL:

```bash
cd backend
npm run build
node -e "require('./dist/db/migrator').runMigrations().then(() => console.log('Migrations complete')).catch(console.error)"
```

### Step 4c. Start Backend API Server
```bash
cd backend
npm install
npm run dev
```

### Step 4d. Start Background Worker
```bash
cd backend
npm run worker
```

### Step 4e. Start Python Data Engine
```bash
cd data-engine
pip install -r requirements.txt
python src/app.py
```

### Step 4f. Start Frontend SPA
```bash
cd frontend
npm install
npm run dev
```

---

## 5. Health & Readiness Endpoints

| Endpoint | Service | Purpose | Expected Response |
| :--- | :--- | :--- | :--- |
| `GET http://localhost:8080/api/health` | Backend | Liveness probe (process is running) | `200 OK` `{ "status": "UP" }` |
| `GET http://localhost:8080/api/ready` | Backend | Readiness probe (Postgres + Redis connected) | `200 OK` `{ "status": "READY", "dependencies": { "postgres": "OK", "redis": "OK" } }` |
| `GET http://localhost:5000/health` | Data Engine | Liveness probe | `200 OK` `{ "status": "UP", "service": "data-engine" }` |
| `GET http://localhost:5000/ready` | Data Engine | Readiness probe (Storage access verified) | `200 OK` `{ "status": "READY", "service": "data-engine" }` |

---

## 6. Running Test Suites

### Backend Unit & Security Tests
```bash
cd backend
# Run all core security & authorization test suites (72/72 tests)
npx jest src/__tests__/audit.test.ts src/__tests__/uploadSecurity.test.ts src/__tests__/security.test.ts src/__tests__/ownership.test.ts src/__tests__/auth.test.ts src/__tests__/aiInterpretation.test.ts --forceExit

# Run full backend test suite (requires active Postgres & Redis instances)
npx jest --forceExit
```

### Python Data Engine Tests
```bash
cd data-engine
pytest
```

### Frontend Build & Type Check
```bash
cd frontend
npm run build
```

---

## 7. Troubleshooting & Common Startup Issues

1. **JWT_SECRET Error on Backend Startup**:
   - *Symptom*: `FATAL: JWT_SECRET environment variable is mandatory for authentication.`
   - *Fix*: Set `JWT_SECRET` in your `.env` file or environment variables.

2. **Database Connection Refused (`ECONNREFUSED 127.0.0.1:5432`)**:
   - *Symptom*: Backend fails readiness check (`postgres: FAIL`).
   - *Fix*: Verify PostgreSQL container/service is running and `POSTGRES_HOST`/`POSTGRES_PORT` in `.env` are accurate.

3. **Redis Connection Error**:
   - *Symptom*: BullMQ worker or backend throws `Redis Client Error`.
   - *Fix*: Ensure Redis service is active on port `6379`.

4. **Python Engine Unreachable (`ECONNREFUSED 127.0.0.1:5000`)**:
   - *Symptom*: Worker analysis jobs fail with HTTP connection error.
   - *Fix*: Ensure Python Flask engine is running on port `5000` (`python src/app.py` or container `datalens-engine`).

5. **Docker Daemon Unavailable on Windows/macOS**:
   - *Symptom*: `failed to connect to the docker API at npipe://...`
   - *Fix*: Launch Docker Desktop application and verify engine status before executing `docker compose up`.

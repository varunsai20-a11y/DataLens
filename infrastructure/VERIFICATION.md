## Infrastructure Verification & Development Commands

### Local Development (Windows PowerShell)

1. **Environment Setup**
   ```powershell
   cp .env.example .env
   ```

2. **Infrastructure Launch**
   ```powershell
   docker compose up --build -d
   ```

3. **Verify System Status**
   ```powershell
   docker compose ps
   ```

4. **Health Checks**
   - Backend Health: `Invoke-RestMethod -Uri http://localhost:8080/api/health`
   - Backend Readiness: `Invoke-RestMethod -Uri http://localhost:8080/api/ready`
   - Engine Health: `Invoke-RestMethod -Uri http://localhost:5000/health`
   - Engine Readiness: `Invoke-RestMethod -Uri http://localhost:5000/ready`

5. **Cleanup**
   - Stop services: `docker compose down`
   - Destroy all data (volumes): `docker compose down -v`

### Service Commands

#### Backend
- Install: `cd backend && npm install`
- Test: `npm test`
- Build: `npm run build`
- Dev: `npm run dev`

#### Data Engine
- Install: `cd data-engine && pip install -r requirements.txt`
- Test: `pytest tests/test_infra.py`
- Run: `python src/app.py`

#### Frontend
- Install: `cd frontend && npm install`
- Build: `npm run build`
- Dev: `npm run dev`

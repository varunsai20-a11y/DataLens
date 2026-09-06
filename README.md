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

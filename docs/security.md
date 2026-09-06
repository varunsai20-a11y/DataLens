# DataLens Security Specification

## 1. Security Strategy
DataLens handles user-uploaded data, which is a primary attack vector. The system adopts a "Zero Trust" approach to file uploads.

## 2. File Upload Security
- **Validation**:
  - Only allowed extensions: `.csv`, `.parquet`.
  - Maximum file size limit (e.g., 100MB for MVP).
  - MIME type verification.
- **Sanitization**:
  - Files are renamed to UUIDs upon upload to prevent directory traversal attacks.
  - Storage is isolated from the application root.
- **Execution Prevention**:
  - The Python engine reads files using Pandas. No `eval()` or `os.system()` calls are ever used on file contents.
  - Storage directory is mounted as read-only for the Python engine where possible.

## 3. API Security
- **Authentication**: JWT-based authentication. Tokens expire after 24 hours.
- **Authorization**: 
  - Users can only access datasets they own.
  - The `/engine/callback` endpoint is protected via a shared secret (API Key) known only to the Node.js and Python services.
- **Input Validation**:
  - All request bodies are validated using `Joi` or `Zod` (Node.js) and `Pydantic` (Python).
  - Strict type checking for all path and query parameters.

## 4. Infrastructure Security
- **Secret Management**:
  - All secrets (DB passwords, JWT secrets, API keys) are stored in a `.env` file.
  - `.env` is added to `.gitignore`.
- **Database**:
  - Least-privilege user for the application.
  - No root access for the Node.js service.
- **Networking**:
  - The Python Engine is not exposed to the public internet. It is only reachable by the Node.js Backend via the internal Docker network.

## 5. Failure Scenarios & Mitigation
| Scenario | Risk | Mitigation |
|---|---|---|
| Malicious CSV (Billion Laughs) | DoS | Use Pandas `chunksize` and set strict memory limits on the Python container. |
| Path Traversal in Upload | Local File Read | Rename files to UUIDs; store in a dedicated `/data` volume. |
| SQL Injection | Data Leak | Use parameterized queries/ORM (e.g., TypeORM or Prisma). |
| JWT Forgery | Unauthorized Access | Use strong, randomly generated secrets; implement token rotation. |

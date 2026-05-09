# Backend Structure

Date: 2026-05-09

## Summary

`digitalPJKform` is a PERN-style app with a Node/Express backend, PostgreSQL persistence, JWT auth, PDF generation, and a Vite React frontend.

Source repo:

```text
C:\Users\scgro\Desktop\Webapp training project\digitalPJKform
```

Target shared backend repo:

```text
C:\Users\scgro\Desktop\Webapp training project\currentSC-official-website-project
```

Project slug: `digitalpjk`

Target namespace:

```text
/api/digitalpjk
```

## Package And Runtime

- Root package manager: npm workspaces with `backend` and `frontend`.
- Backend package: `backend/package.json`.
- Backend module system: ESM (`"type": "module"`).
- Backend framework: Express 4 in the source repo.
- Frontend package: `frontend/package.json`.
- Frontend framework: Vite + React.
- Root lockfile: `package-lock.json`.

## Backend Entry Points

- App module: `backend/src/app.js`
- Server listen entry point: `backend/src/server.js`
- Backend start script: `npm run start --workspace backend`
- Dev script: `npm run dev --workspace backend`

`backend/src/server.js` loads branch JSON configs at startup, then calls `app.listen`.

## High-Level Architecture

```text
backend/src/app.js
  -> CORS
  -> express.json()
  -> routes mounted under /api
  -> notFoundHandler
  -> errorHandler

backend/src/routes/*
  -> controllers
  -> services
  -> db/pool.js
  -> PostgreSQL

frontend/src/api/client.js
  -> VITE_DIGITALPJK_API_BASE_URL + VITE_DIGITALPJK_API_PREFIX
  -> production fallback to https://sc-official-website.onrender.com/api/digitalpjk
  -> local development fallback to same-origin /api
```

## Folder And File Map

```text
backend/src/
  app.js
  server.js
  config/
    constants.js
  controllers/
    admin-settings.controller.js
    auth.controller.js
    branches.controller.js
    documents.controller.js
    health.controller.js
    pharmacists.controller.js
  db/
    pool.js
    migrate.js
    seed.js
    setup.js
    syncBranchesFromFiles.js
    syncPartTimePharmacists.js
    migrations/
  middleware/
    auth.middleware.js
    error.middleware.js
    login-rate-limit.middleware.js
  routes/
    admin.routes.js
    auth.routes.js
    branches.routes.js
    documents.routes.js
    health.routes.js
    pharmacists.js
  services/
    auth.service.js
    branchConfigService.js
    branches.service.js
    document-date.service.js
    document-persistence.service.js
    pdfService.js
    pdfStampService.js
    user-profile.service.js
  assets/
    fonts/
    templates/
  data/
    branches/
```

## API Route Summary

Current standalone source routes:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/login` | Public + rate limit | Returns JWT and profile |
| GET | `/api/auth/me` | Bearer JWT | Current user profile |
| GET | `/api/me` | Bearer JWT | Alias for current user profile |
| GET | `/api/branches` | Bearer JWT | Admin sees all; users see own branch |
| GET | `/api/branches/:id` | Bearer JWT | Branch details with role/branch authorization |
| GET | `/api/admin/settings` | Admin JWT | Global date settings |
| PUT | `/api/admin/settings` | Admin JWT | Updates global date settings |
| POST | `/api/documents/generate` | Bearer JWT | Generates PDF; optional `save=true` writes document row |
| POST | `/api/documents/generate-merged` | Bearer JWT | Generates merged PDF; optional `save=true` writes document row |
| GET | `/api/documents/debug-grid` | Bearer JWT | Returns PDF debug grid |
| GET | `/api/documents/recent` | Bearer JWT | Recent saved documents |
| GET | `/api/documents/:id` | Bearer JWT | Document metadata or regenerated PDF with `format=pdf` |
| GET | `/api/pharmacists/part-time` | Bearer JWT | Part-time pharmacist list |

Shared backend route mapping:

```text
old: /api/health
new: /api/digitalpjk/health

old: /api/auth/login
new: /api/digitalpjk/auth/login

old: /api/documents/generate
new: /api/digitalpjk/documents/generate
```

All other `/api/*` routes follow the same `/api/digitalpjk/*` namespace.

## Auth And Security Middleware

- Auth model: Bearer JWT in the `Authorization` header.
- JWT signing and verification: `backend/src/services/auth.service.js`.
- Required env after namespacing: `DIGITALPJK_JWT_SECRET`.
- Token isolation: JWTs are signed and verified with `issuer=digitalpjk` and `audience=digitalpjk`.
- Token payload requires `userId` and `role`, and non-admin users require `branchId`.
- Login route uses in-memory IP rate limiting via `login-rate-limit.middleware.js`.
- Rate-limit env names are now `DIGITALPJK_LOGIN_RATE_LIMIT_WINDOW_MS` and `DIGITALPJK_LOGIN_RATE_LIMIT_MAX`.
- CORS still uses source-level `CORS_ORIGIN` in the standalone repo.
- No cookie auth, CSRF middleware, Helmet, or general API rate limiter found.

Shared-service notes:

- DigitalPJK must not use the shared website `JWT_SECRET`.
- Existing browser tokens from the old standalone backend will not validate after the issuer/audience change. Users should log in again after cutover.
- Do not use wildcard CORS with credentials.

## Database And Migrations

Database client:

```text
backend/src/db/pool.js
```

Required DB env after namespacing:

```text
DIGITALPJK_DATABASE_URL
```

The DB pool is lazy and fail-closed. It does not fall back to shared `DATABASE_URL`.

Migrations:

```text
backend/src/db/migrations/001_init_schema.sql
backend/src/db/migrations/002_documents_table.sql
backend/src/db/migrations/003_part_time_pharmacists.sql
backend/src/db/migrations/004_users_branch_role_constraint.sql
```

DB scripts:

- `npm run migrate --workspace backend`
- `npm run seed --workspace backend`
- `npm run syncBranchesFromFiles --workspace backend`
- `npm run syncPartTimePharmacists --workspace backend`
- `npm run db:setup`

Important migration risk:

- `render.yaml` no longer wires migrations into `preDeployCommand`.
- Do not run the copied migrations or seed/sync scripts until the database backup/review gate passes.
- In the shared backend, migrations are copied for traceability only and marked copied-not-executed.

## Workers, Queues, Webhooks, Uploads, Cron

- No queue library, worker process, cron scheduler, WebSocket server, or webhook receiver found.
- No multipart upload middleware found.
- PDF files are generated from backend assets and returned to the browser.
- `DIGITALPJK_PDF_WRITE_SAMPLE=true` can write sample PDFs to disk and should remain disabled in shared production unless explicitly needed.

## Frontend Build And API Target

Frontend API client:

```text
frontend/src/api/client.js
```

Preferred shared-service frontend env:

```text
VITE_DIGITALPJK_API_BASE_URL
VITE_DIGITALPJK_API_PREFIX
```

Recommended Render values:

```text
VITE_DIGITALPJK_API_BASE_URL=<shared-backend-origin>
VITE_DIGITALPJK_API_PREFIX=/api/digitalpjk
```

`VITE_API_BASE_URL` is intentionally no longer used by DigitalPJK code. This avoids baking another project's backend URL into the DigitalPJK production bundle.

If the static Render service does not expose the project-scoped Vite variables, production builds fall back to the shared backend origin and `/api/digitalpjk`. These fallback values are public routing config, not secrets.

## Deployment Files

Render Blueprint:

```text
render.yaml
```

The Blueprint defines:

- Web service: `digitalpjkform`
- Static service: `digitalpjkformsite`

Old standalone service ID from the user prompt:

```text
srv-d6ft1ncr85hc73b2k6qg
```

Target shared service ID from the user prompt:

```text
srv-d58idfm3jp1c73bhgv40
```

No Render mutation has been performed.

## Environment Variable Summary

Backend env names used after namespacing:

```text
PORT
CORS_ORIGIN
NODE_ENV
DIGITALPJK_DATABASE_URL
DIGITALPJK_JWT_SECRET
DIGITALPJK_JWT_EXPIRES_IN
DIGITALPJK_CEO_NAME_TH
DIGITALPJK_LOGIN_RATE_LIMIT_WINDOW_MS
DIGITALPJK_LOGIN_RATE_LIMIT_MAX
DIGITALPJK_PDF_WRITE_SAMPLE
DIGITALPJK_PDF_SAMPLE_DIR
```

Frontend env names used after namespacing:

```text
VITE_DIGITALPJK_API_BASE_URL
VITE_DIGITALPJK_API_PREFIX
```

Local untracked `.env` files may still contain old generic names. Those files were removed from git tracking and should be updated manually in Render/local secrets without copying values into docs.

## Env Collision Audit

The env collision audit report is:

```text
ENV_VAR_COLLISION_AUDIT.md
```

Findings after cleanup:

- No tracked live `.env` files detected.
- DigitalPJK code uses project-scoped DB/JWT/PDF/rate-limit env names.
- The target website still legitimately has its own shared `DATABASE_URL` and `JWT_SECRET`; DigitalPJK does not read those.
- Local untracked `.env` files still need manual secret-manager cleanup/rotation review.
- `VITE_API_BASE_URL` was removed from DigitalPJK code to avoid frontend build collisions.

## Risks And Unclear Areas

- Target repo is CommonJS Express 5; source is ESM Express 4. Integration uses a narrow dynamic-import bridge in the target.
- Database migrations were not run. A backup and explicit DB approval are still required.
- Source CORS fallback is permissive when `CORS_ORIGIN` is unset.
- The target production audit still has one moderate Nodemailer advisory that requires a major-version upgrade to fully clear.
- Successful DB-backed behavior still needs a safe DigitalPJK test database or a reviewed staging DB.
- Frontend is `BrowserRouter`; static hosting needs rewrite behavior.

## Future Migration Notes

- Mount routes under `/api/digitalpjk`.
- Keep module files under `backend/src/modules/digitalpjk`.
- Require `DIGITALPJK_DATABASE_URL` and `DIGITALPJK_JWT_SECRET`.
- Copy migrations into the target as copied-not-executed.
- Add target smoke tests for namespaced health, auth failures, protected routes, and DB-fail-safe behavior.
- Keep Render decommissioning separate from migration.

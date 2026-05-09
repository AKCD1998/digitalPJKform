# Backend Test Baseline

Date: 2026-05-09

## Scope

This baseline captures lightweight, non-destructive backend behavior before and during migration of `digitalPJKform` into the shared currentSC backend.

The tests do not connect to PostgreSQL and do not run migrations, seeds, sync scripts, or PDF persistence flows.

## How To Run

```powershell
npm --prefix backend test
```

## Test Setup

- Test framework: Node built-in test runner.
- Test file: `backend/tests/backend-smoke.test.js`.
- `NODE_ENV=test` is set.
- `DIGITALPJK_DATABASE_URL` is forced to an empty value so accidental DB connections are avoided.
- `DIGITALPJK_JWT_SECRET` is set to a test-only value.
- Generic `DATABASE_URL` and `JWT_SECRET` are not used by DigitalPJK code.
- The backend is started on a random local port.

## Coverage

- App, DB pool module, routes, controllers, middleware, and representative services import safely.
- `GET /api/health` returns `200` with `{ "ok": true }`.
- `POST /api/auth/login` with an empty body returns `400`.
- `GET /api/me` without a token returns `401`.
- Protected routes return `401` before database work:
  - `GET /api/branches`
  - `GET /api/branches/:id`
  - `GET /api/admin/settings`
  - `PUT /api/admin/settings`
  - `GET /api/documents/recent`
  - `GET /api/documents/debug-grid`
  - `GET /api/documents/:id`
  - `POST /api/documents/generate`
  - `POST /api/documents/generate-merged`
  - `GET /api/pharmacists/part-time`
- Unknown routes return JSON `404`.

## Not Covered Yet

- Successful login, because it requires a real database row.
- Authenticated branch, document, admin, and pharmacist behavior.
- PDF rendering output correctness.
- Database migrations, seed scripts, branch sync, or part-time pharmacist sync.
- Render deployment behavior.

## Skipped Routes And Why

No route is skipped entirely, but DB-backed success paths are limited to unauthenticated failure checks to avoid touching production or migration databases.

## DB Safety

The test suite does not run any database operation. DB-backed routes are exercised only in unauthenticated states where middleware returns `401` before controller/database code runs.

Latest verification:

```text
npm --prefix backend test
5 tests passed
```

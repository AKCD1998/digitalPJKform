# Env Var Collision Audit

Date: 2026-05-09

Values are intentionally omitted. This report lists env names only.

## Repos Scanned

| Repo | Runtime Boundary |
|---|---|
| `C:\Users\scgro\Desktop\Webapp training project\digitalPJKform` | Source backend and frontend |
| `C:\Users\scgro\Desktop\Webapp training project\currentSC-official-website-project` | Target shared backend |

Tooling availability:

- `dotenv-linter`: not found
- `gitleaks`: not found
- `trufflehog`: not found
- Bundled `env_audit.py`: run; it exits non-zero while local untracked `.env` files still contain legacy generic names.

## Tracked Env Files

- No tracked live `.env` files remain.
- `frontend/.env` and `frontend/.env.production` were removed from git tracking.
- `.gitignore` now ignores `backend/.env`, `frontend/.env`, and `frontend/.env.production`.

Tracked templates:

- `digitalPJKform/backend/.env.example`
- `currentSC-official-website-project/backend/.env.example`

## Final Classification

| Env Name | Classification | Decision |
|---|---|---|
| `DATABASE_URL` | P0 if read by DigitalPJK in shared runtime | DigitalPJK code no longer reads it. Use `DIGITALPJK_DATABASE_URL`. |
| `JWT_SECRET` | P0 if read by DigitalPJK in shared runtime | DigitalPJK code no longer reads it. Use `DIGITALPJK_JWT_SECRET`. |
| `VITE_API_BASE_URL` | P1/P2 frontend collision | DigitalPJK code no longer reads it. Use project-scoped Vite vars. |
| `CORS_ORIGIN` | P2 shared runtime config | Still shared at the target app level; verify deployed allowlist before cutover. |
| `PORT`, `NODE_ENV` | Info/common runtime | Safe as normal process-level variables. |
| `DIGITALPJK_*` | Intended project-scoped names | Required for the migrated module. |

## Required DigitalPJK Env Names

Backend:

```text
DIGITALPJK_DATABASE_URL
DIGITALPJK_JWT_SECRET
DIGITALPJK_JWT_EXPIRES_IN
DIGITALPJK_CEO_NAME_TH
DIGITALPJK_LOGIN_RATE_LIMIT_WINDOW_MS
DIGITALPJK_LOGIN_RATE_LIMIT_MAX
DIGITALPJK_PDF_WRITE_SAMPLE
DIGITALPJK_PDF_SAMPLE_DIR
```

Frontend:

```text
VITE_DIGITALPJK_API_BASE_URL
VITE_DIGITALPJK_API_PREFIX
```

## Manual Render/GitHub Changes

For the target shared Render service `srv-d58idfm3jp1c73bhgv40`, add names only:

```text
DIGITALPJK_DATABASE_URL
DIGITALPJK_JWT_SECRET
DIGITALPJK_JWT_EXPIRES_IN
DIGITALPJK_CEO_NAME_TH
DIGITALPJK_LOGIN_RATE_LIMIT_WINDOW_MS
DIGITALPJK_LOGIN_RATE_LIMIT_MAX
DIGITALPJK_PDF_WRITE_SAMPLE
DIGITALPJK_PDF_SAMPLE_DIR
```

For the DigitalPJK frontend build environment, use names only:

```text
VITE_DIGITALPJK_API_BASE_URL
VITE_DIGITALPJK_API_PREFIX
```

Do not add `VITE_API_BASE_URL` for DigitalPJK.

## Remaining Risks

- Local untracked `.env` files may still contain old generic names. They were not edited to avoid reading or rewriting secret values.
- If old generic secrets were ever committed, rotate them and run a real history secret scanner.
- The target website still has its own shared `DATABASE_URL` and `JWT_SECRET`; this is acceptable only because DigitalPJK does not read them.
- CORS must be verified with the final deployed frontend origin before old-service decommission.

## Verification

- Source backend tests passed.
- Target backend tests passed.
- DigitalPJK frontend build passed with `VITE_DIGITALPJK_API_BASE_URL` and `VITE_DIGITALPJK_API_PREFIX`.
- Production bundle contains the shared backend origin and `/api/digitalpjk`.
- Production bundle does not contain the old standalone DigitalPJK backend URL or `VITE_API_BASE_URL`.

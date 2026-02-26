# PERN Bootstrap (Backend + Frontend)

Fresh PERN stack scaffold with:

- Backend: Node.js + Express
- Database: PostgreSQL (`pg`)
- Frontend: React + Vite
- Auth utilities ready: JWT + bcrypt
- PDF utility ready: `pdf-lib`
- SQL migrations + seed scripts for PostgreSQL

## Project Structure

```text
/backend
  /src
    /assets
      /fonts
    /data
      /branches
    /db
    /routes
    /controllers
    /middleware
    /services
    app.js
    server.js
  package.json
  .env.example
/frontend
  /src
    /pages
    /components
    /api
    /styles
    main.jsx
    App.jsx
  package.json
  vite.config.js
/README.md
```

## Setup

1. Install dependencies from the root:

```bash
npm install
```

2. Create backend env file:

```bash
cp backend/.env.example backend/.env
```

On Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

3. Update values in `backend/.env` as needed (`DATABASE_URL`, `JWT_SECRET`, etc.).
   - Optional CEO constant override: `CEO_NAME_TH` (default is `ทรงพล ลิ้มพิสูจน์`)
   - Optional JWT TTL: `JWT_EXPIRES_IN` (default `1h`)
   - Optional login rate limit: `LOGIN_RATE_LIMIT_WINDOW_MS`, `LOGIN_RATE_LIMIT_MAX`
   - Optional PDF sample save: `PDF_WRITE_SAMPLE=true` and `PDF_SAMPLE_DIR` (default temp dir)

## Commands

- Install: `npm install`
- Run backend + frontend in dev mode: `npm run dev`
- Run SQL migrations: `npm run migrate`
- Sync branches from JSON files: `npm run syncBranchesFromFiles`
- Run seed data: `npm run seed`
- Run migrations + seed together: `npm run db:setup`

## Migrations and Seed

- Migration files live in: `backend/src/db/migrations`
- Migration runner: `backend/src/db/migrate.js`
- Branch JSON source files: `backend/src/data/branches/*.json`
- Branch loader service: `backend/src/services/branchConfigService.js`
- Branch sync runner: `backend/src/db/syncBranchesFromFiles.js`
- Seed runner: `backend/src/db/seed.js`
- CEO declaration constant: `backend/src/config/constants.js`
- Document persistence table: `documents` (migration `002_documents_table.sql`)

Seeded branches:

- `001` สาขาตลาดแม่กลอง
- `003` สาขาวัดช่องลม
- `004` สาขาตลาดบางน้อย

Branch source-of-truth:

- Branch profiles are maintained in JSON files under `backend/src/data/branches`.
- File name is the `branch_code` (for example `001.json`).
- Server loads and validates these files on startup.
- To upsert file changes into PostgreSQL, run `npm run syncBranchesFromFiles`.

Add a new branch:

1. Create a new JSON file in `backend/src/data/branches`, e.g. `005.json`.
2. Add required fields:
   `pharmacy_name_th`, `branch_name_th`, `address_no`, `soi`, `district`, `province`,
   `postcode`, `phone`, `license_no`, `location_text`, `operator_title`, `operator_work_hours`.
3. Run `npm run syncBranchesFromFiles` to upsert the new branch into `branches` table.

Seeded users:

- `admin000` / `Admin@123` (`admin`, branch `001`)
- `user001` / `User@123` (`user`, branch `001`)
- `user003` / `User@123` (`user`, branch `003`)
- `user004` / `User@123` (`user`, branch `004`)

## Health Check

- Backend endpoint: `GET /api/health`
- Response:

```json
{ "ok": true }
```

The frontend calls `/api/health` and displays the response on the page.

## Authentication API

Token strategy:

- Backend returns JWT in JSON response body (`token`)
- No httpOnly cookie is used in this bootstrap
- Frontend can store token in `localStorage` (or another client-side store)

### POST `/api/auth/login`

Postman:

- Method: `POST`
- URL: `http://localhost:5000/api/auth/login`
- Body: `raw` + `JSON`

Request body:

```json
{
  "username": "admin000",
  "password": "Admin@123"
}
```

Success response (`200`):

```json
{
  "token": "eyJhbGciOi...",
  "documentDate": {
    "mode": "system",
    "dateISO": "2026-02-26",
    "thai": {
      "day": 26,
      "monthNameTh": "กุมภาพันธ์",
      "yearBE": 2569
    }
  },
  "user": {
    "username": "admin000",
    "role": "admin",
    "displayNameTh": "ผู้ดูแลระบบ"
  },
  "branch": {
    "id": "c9e0f5f0-aaaa-bbbb-cccc-1234567890ab",
    "branchCode": "001",
    "pharmacyNameTh": "ศิริชัยเภสัช",
    "branchNameTh": "ตลาดแม่กลอง",
    "addressNo": "99/1 DUMMY",
    "soi": "ซอยตัวอย่าง 1",
    "district": "แม่กลอง",
    "province": "สมุทรสงคราม",
    "postcode": "75000",
    "phone": "000-000-0001",
    "licenseNo": "LIC-DUMMY-001",
    "locationText": "สมุทรสงคราม",
    "operatorTitle": "นาย",
    "operatorWorkHours": "09:00-18:00"
  }
}
```

Error responses:

- `400` when `username`/`password` is missing
- `401` when credentials are invalid
- `429` when login rate limit is exceeded

### GET `/api/me`

Postman:

- Method: `GET`
- URL: `http://localhost:5000/api/me`
- Header: `Authorization: Bearer <token>`

Headers:

```text
Authorization: Bearer <token>
```

Success response (`200`):

```json
{
  "documentDate": {
    "mode": "system",
    "dateISO": "2026-02-26",
    "thai": {
      "day": 26,
      "monthNameTh": "กุมภาพันธ์",
      "yearBE": 2569
    }
  },
  "user": {
    "username": "admin000",
    "role": "admin",
    "displayNameTh": "ผู้ดูแลระบบ"
  },
  "branch": {
    "id": "c9e0f5f0-aaaa-bbbb-cccc-1234567890ab",
    "branchCode": "001",
    "pharmacyNameTh": "ศิริชัยเภสัช",
    "branchNameTh": "ตลาดแม่กลอง",
    "addressNo": "99/1 DUMMY",
    "soi": "ซอยตัวอย่าง 1",
    "district": "แม่กลอง",
    "province": "สมุทรสงคราม",
    "postcode": "75000",
    "phone": "000-000-0001",
    "licenseNo": "LIC-DUMMY-001",
    "locationText": "สมุทรสงคราม",
    "operatorTitle": "นาย",
    "operatorWorkHours": "09:00-18:00"
  }
}
```

Error responses:

- `401` for missing/invalid/expired token
- `404` if the user no longer exists

### GET `/api/admin/settings` (admin only)

Postman:

- Method: `GET`
- URL: `http://localhost:5000/api/admin/settings`
- Header: `Authorization: Bearer <admin-token>`

Success response (`200`):

```json
{
  "settings": {
    "useSystemDate": true,
    "forcedDate": null,
    "updatedBy": "user-uuid-or-null",
    "updatedAt": "2026-02-26T12:00:00.000Z"
  },
  "documentDate": {
    "mode": "system",
    "dateISO": "2026-02-26",
    "thai": {
      "day": 26,
      "monthNameTh": "กุมภาพันธ์",
      "yearBE": 2569
    }
  }
}
```

### PUT `/api/admin/settings` (admin only)

Postman:

- Method: `PUT`
- URL: `http://localhost:5000/api/admin/settings`
- Header: `Authorization: Bearer <admin-token>`
- Body: `raw` + `JSON`

Request examples:

```json
{
  "useSystemDate": true,
  "forcedDate": null
}
```

```json
{
  "useSystemDate": false,
  "forcedDate": "2026-03-15"
}
```

Validation:

- `useSystemDate` must be boolean.
- When `useSystemDate=false`, `forcedDate` must be `YYYY-MM-DD`.

### POST `/api/documents/generate` (auth required)

Postman:

- Method: `POST`
- URL: `http://localhost:5000/api/documents/generate`
- Header: `Authorization: Bearer <token>`
- Body: `raw` + `JSON`

Request body:

```json
{
  "templateKey": "form_gor_gor_1",
  "formData": {
    "soi": "ซอยที่แก้ไข",
    "addressNo": "123/45",
    "customNote": "ข้อมูลเพิ่มเติม"
  }
}
```

Behavior:

- Backend merges:
  - fixed CEO name (`ทรงพล ลิ้มพิสูจน์`, or `CEO_NAME_TH` from env)
  - user branch profile from DB (`branches` table)
  - date from document date rules (`system` / `forced`)
  - `formData` overrides + extra typed fields (for expansion)
- Stamps values on top of a template PDF from `backend/src/assets/templates/<templateKey>.pdf`
- Coordinates come from `backend/src/assets/templates/<templateKey>.fields.json`
- Response: `application/pdf` binary with `Content-Disposition: attachment`

Optional persistence:

- Use query: `POST /api/documents/generate?save=true`
- If `save=true`, backend writes to `documents` table and returns header:
  `X-Document-Id: <uuid>`

### GET `/api/documents/debug-grid?templateKey=form_gor_gor_1` (auth required)

Returns the selected template PDF with:

- grid lines every 20 units
- axis labels for quick coordinate reading
- coordinate markers every 100 units

Use this endpoint while tuning field `x,y` values in `<templateKey>.fields.json`.

### GET `/api/documents/:id` (auth required)

Supports:

- `GET /api/documents/:id` -> JSON payload metadata
- `GET /api/documents/:id?format=pdf` -> regenerate/download PDF

Access control:

- `admin` can access all documents
- `user` can access only documents in their own branch

JSON response example:

```json
{
  "id": "document-uuid",
  "createdBy": "user-uuid",
  "createdByUsername": "admin000",
  "branchId": "branch-uuid",
  "branchCode": "001",
  "createdAt": "2026-02-26T13:30:00.000Z",
  "payload": {
    "ceoNameTh": "ทรงพล ลิ้มพิสูจน์"
  }
}
```

### GET `/api/documents/recent?limit=10` (auth required)

Returns recent document metadata.

- Admin sees all branches.
- User sees only own branch.

Response shape:

```json
{
  "documents": [
    {
      "id": "document-uuid",
      "createdAt": "2026-02-26T13:30:00.000Z",
      "createdBy": "user-uuid",
      "createdByUsername": "admin000",
      "branchId": "branch-uuid",
      "branchCode": "001",
      "documentDateISO": "2026-02-26"
    }
  ]
}
```

Optional dev sample output:

- If `PDF_WRITE_SAMPLE=true`, backend writes a copy to temp dir (or `PDF_SAMPLE_DIR`)
- Response includes `X-Sample-Pdf-Path` header with saved path

## Notes

- Frontend dev server runs on `http://localhost:5173`
- Backend runs on `http://localhost:5000`
- Vite proxy forwards `/api/*` to the backend.

## Frontend Routes

- `/login` : username/password login form
- `/form` : protected page (redirects to `/login` when unauthenticated)

Session behavior:

- Token + user/branch profile are stored in memory and `localStorage` after login.
- On page refresh, frontend calls `GET /api/me` to restore session/profile.
- `documentDate` from backend is used to render วันที่/เดือน/พ.ศ. in `/form`.
- Admin can update date mode/date from the `/form` admin panel (calls `/api/admin/settings`).
- `/form` has a `Generate PDF` button that calls `/api/documents/generate` and opens/downloads the PDF.
- Admin also sees a small Recent Documents list (last 10) and can reopen saved PDFs.

## PDF Font Setup

- Put a real Thai-capable font file at:
  `backend/src/assets/fonts/THSarabunNew.ttf`
- PDF generation will fail with a clear error if the font is missing or still a placeholder.

## Template Stamping Setup

- Put template files in `backend/src/assets/templates`.
- Naming convention per template:
  - PDF: `<templateKey>.pdf`
  - Coordinates: `<templateKey>.fields.json`
- Example:
  - `form_gor_gor_1.pdf`
  - `form_gor_gor_1.fields.json`

Field mapping example:

```json
{
  "page": 0,
  "fields": {
    "ceoNameTh": { "x": 228, "y": 701, "size": 20 },
    "pharmacyDisplayName": { "x": 228, "y": 666, "size": 20 },
    "dateDay": { "x": 96, "y": 281, "size": 20, "maxWidth": 40, "align": "center" }
  }
}
```

## How To Calibrate Fields

1. Call `GET /api/documents/debug-grid?templateKey=form_gor_gor_1` with a valid Bearer token.
2. Open the returned PDF and read exact coordinates from the grid/labels.
3. Edit `backend/src/assets/templates/form_gor_gor_1.fields.json`.
4. Regenerate a document using `POST /api/documents/generate` with the same `templateKey`.
5. Repeat until text aligns with the printed lines exactly.

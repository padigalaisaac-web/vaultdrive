# VaultDrive — Offline-First Personal Storage

> A secure, offline-first personal file-storage application combining Google Drive + Dropbox + an offline-first file manager with an original UI and architecture.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-green.svg)](https://expressjs.com/)
[![Dexie](https://img.shields.io/badge/Dexie.js-IndexedDB-orange.svg)](https://dexie.com/)
[![Tests](https://img.shields.io/badge/Tests-26%20Passed-emerald.svg)](https://vitest.dev/)

---

## 1. Project Structure

```text
vaultdrive/
├── client/                     # Frontend (React 19 + TypeScript + Vite + Tailwind + Dexie)
│   ├── public/
│   │   ├── favicon.svg         # Vault + Cloud branding logo
│   │   ├── manifest.json       # PWA manifest
│   │   └── sw.js               # Service Worker with offline shell cache
│   ├── src/
│   │   ├── components/
│   │   │   ├── files/          # FileCard, FolderCard, FilePreview
│   │   │   ├── layout/         # AppLayout, Sidebar, Navbar, MobileBottomNav
│   │   │   ├── onboarding/     # OnboardingModal (4-step walkthrough)
│   │   │   ├── sharing/        # ShareModal (link generator with password/expiration)
│   │   │   ├── sync/           # ConflictModal (Keep Server, Keep Local, Save Both)
│   │   │   ├── ui/             # Button, Input, Modal, ProgressBar, Spinner, Tooltip
│   │   │   ├── upload/         # UploadManager (chunked uploads, duplicate check, queue)
│   │   │   ├── DropZone.tsx    # Drag-and-drop file upload overlay
│   │   │   ├── FileIcon.tsx    # Category-based SVG icon rendering
│   │   │   ├── NetworkStatus.tsx # Real-time online/offline indicator badge
│   │   │   └── OfflineBanner.tsx # Dynamic banner when connection is lost
│   │   ├── db/
│   │   │   ├── schema.ts       # Dexie IndexedDB tables (files, folders, offlineFiles, queues)
│   │   │   └── index.ts        # Database helpers & queries
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx   # Storage breakdown, quota usage, recent files
│   │   │   ├── MyFilesPage.tsx     # Core file manager (breadcrumbs, grid/list, sorting)
│   │   │   ├── OfflineFilesPage.tsx# Offline-accessible files & device cache management
│   │   │   ├── RecentPage.tsx      # Recently modified files
│   │   │   ├── FavoritesPage.tsx   # Starred files
│   │   │   ├── TrashPage.tsx       # Recycle bin with restore & permanent delete
│   │   │   ├── SharedPage.tsx      # Public share links & revocations
│   │   │   ├── SearchPage.tsx      # Fast live search by name, type, and extension
│   │   │   ├── SettingsPage.tsx    # Storage stats, clear cache, sync rules, theme
│   │   │   ├── LoginPage.tsx       # Secure user sign in
│   │   │   ├── RegisterPage.tsx    # Account creation
│   │   │   └── PublicSharePage.tsx # Public viewer with password & stream download
│   │   ├── services/           # api, authService, fileService, folderService, offlineStorageService
│   │   ├── stores/             # Zustand state management (appStore)
│   │   ├── sync/               # networkDetector & syncEngine
│   │   ├── types/              # TypeScript interfaces
│   │   ├── utils/              # formatters, mime, hash, pwa
│   │   ├── App.tsx             # Route definitions & protected route guards
│   │   └── main.tsx            # React application entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/                     # Backend (Node.js + Express + TypeScript + PostgreSQL)
│   ├── src/
│   │   ├── config/             # Environment variables parser
│   │   ├── controllers/        # auth, file, folder, sync, share, trash, storage, search
│   │   ├── db/                 # schema.sql, dbAdapter (PostgreSQL + persistent fallback)
│   │   ├── middleware/         # auth (JWT), errorHandler, rateLimiter, validate
│   │   ├── routes/             # REST endpoints (/api/auth, /api/files, /api/sync, etc.)
│   │   ├── services/
│   │   │   └── storage/        # StorageProvider, LocalStorageProvider, S3StorageProvider
│   │   ├── types/              # Backend TypeScript types
│   │   ├── utils/              # crypto, pathSanitizer, mimeHelper
│   │   ├── validators/         # Zod schemas for all payload validations
│   │   ├── app.ts              # Express application configuration
│   │   └── server.ts           # Server bootstrap and database listener
│   ├── tests/                  # 26 automated integration tests with Vitest & Supertest
│   │   ├── auth.test.ts
│   │   ├── files.test.ts
│   │   ├── folders.test.ts
│   │   ├── sync.test.ts
│   │   ├── security.test.ts
│   │   └── e2e_offline_scenario.test.ts # Verifies scenario #40 in specification
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── package.json                # Monorepo root workspace configuration
└── README.md
```

---

## 2. How to Install

```bash
# Clone the repository
cd vaultdrive

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

---

## 3. How to Run Frontend

```bash
cd client
npm run dev
```

The frontend will start at **http://localhost:5173** and proxies `/api` requests to `http://localhost:5000`.

---

## 4. How to Run Backend

```bash
cd server
npm run dev
```

The backend starts at **http://localhost:5000**.
To run unit and end-to-end integration tests:

```bash
cd server
npm test
```

To run a production build:

```bash
npm run build
npm start
```

---

## 5. How to Configure PostgreSQL

VaultDrive connects to PostgreSQL via `DATABASE_URL`.

1. Install or run PostgreSQL (e.g. via Docker):
   ```bash
   docker run --name vaultdrive-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vaultdrive -p 5432:5432 -d postgres:16-alpine
   ```
2. Configure `.env` in `server/`:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vaultdrive
   ```
3. When the server boots, it automatically runs `schema.sql` to initialize all tables, foreign keys, and indexes.
4. If PostgreSQL is not running during local testing, VaultDrive's built-in resilient database adapter seamlessly falls back to a persistent JSON store in `server/storage/vaultdrive_local_db.json`, ensuring development and testing never crash.

---

## 6. How to Configure Local Storage

In `server/.env`:

```env
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=./storage
```

Files will be structured as:
```text
/storage
  /users
    /<user-id>
      /documents
      /images
      /videos
      /other
```

Strict path sanitization prevents directory traversal attacks (`../` is rejected and contained).

---

## 7. How to Configure S3 Storage

To use AWS S3, Cloudflare R2, MinIO, or DigitalOcean Spaces, set in `server/.env`:

```env
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com # Optional (for MinIO/R2)
S3_REGION=auto
S3_BUCKET=my-vaultdrive-bucket
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_FORCE_PATH_STYLE=false # true for MinIO
```

No code modifications are required; the `StorageProvider` abstraction transparently handles uploads, range streaming, and multipart chunk assembly.

---

## 8. How Offline Mode Works

1. **IndexedDB (Dexie.js)**:
   All folders, files, favorite statuses, and sync queues are stored in the browser's IndexedDB.
2. **Available Offline ✓**:
   - When a user marks a file as **Available Offline**, the client calls `navigator.storage.estimate()` to verify adequate device storage.
   - The file binary is downloaded and saved as a `Blob` in the `offlineFiles` table in IndexedDB.
   - When offline, images, PDFs, videos, audio, and text files render directly from the offline `Blob` without network requests.
   - Downloading works directly from the local Blob.
3. **Offline Actions**:
   - Creating folders, updating metadata, or moving files to trash executes immediately in IndexedDB so the UI is responsive.
   - Actions are placed in the `syncQueue` table with a client timestamp.
   - Uploading a file offline queues the binary file in the `uploadQueue` table.

---

## 9. How Synchronization Works

The **SyncEngine** monitors network connectivity using both `navigator.onLine` and a lightweight ping heartbeat (`GET /api/sync/ping`).

When internet is restored:
1. **Push Sync Queue**: The client sends queued operations in batch to `POST /api/sync/push`.
2. **Push Upload Queue**: Queued file uploads are uploaded to `POST /api/files/upload`.
3. **Pull Changes**: The client fetches server changes since the last sync timestamp via `GET /api/sync/pull?since=...` and merges them into IndexedDB.
4. **Conflict Handling**:
   - If a file or folder was edited both locally and on the server, a conflict is detected.
   - A Conflict Resolution modal appears offering:
     - **Save Both (Safest Default)**: Appends `(Local Conflict Copy)` to ensure zero data loss.
     - **Keep Server**: Discards local offline edit and adopts server state.
     - **Keep Local**: Overwrites server state with local change.
5. UI displays `✓ Synced`.

---

## 10. How to Deploy Frontend

The client builds to pure static HTML/JS/CSS in `client/dist`.

### Vercel / Netlify / Cloudflare Pages
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variable**: `VITE_API_URL=https://api.yourdomain.com/api`

---

## 11. How to Deploy Backend

Deploy the backend to Railway, Render, Fly.io, or VPS:

### Dockerfile Example:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist
COPY src/db/schema.sql ./dist/db/schema.sql
EXPOSE 5000
CMD ["node", "dist/server.js"]
```

---

## 12. Production Environment Variables

### Backend (`server/.env`):
```env
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://user:password@pg-host:5432/vaultdrive?sslmode=require
JWT_SECRET=super_secret_production_key_replace_this
JWT_EXPIRES_IN=30d
STORAGE_PROVIDER=s3
S3_ENDPOINT=
S3_REGION=us-east-1
S3_BUCKET=production-vaultdrive-bucket
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=wJal...
CLIENT_ORIGIN=https://vaultdrive.yourdomain.com
MAX_UPLOAD_SIZE_BYTES=5368709120
DEFAULT_USER_QUOTA_BYTES=10737418240
```

### Frontend (`client/.env`):
```env
VITE_API_URL=https://api.yourdomain.com/api
```

---

## 13. Verification Results

All automated test suites passing:
- **Authentication**: Register, login, duplicate email check, invalid passwords, unauthorized access.
- **Files**: Direct upload, chunked upload, duplicate detection (SHA-256), range streaming, metadata updates, soft delete.
- **Folders**: Nested folders, breadcrumbs path calculation, renaming, moving.
- **Security**: Path traversal prevention (`../` and `..\` containment), sanitized filenames, protected endpoints.
- **E2E Offline Scenario #40**: Simulates user login -> creates folder `College` -> uploads PDF, image, zip, video -> marks offline -> cuts network -> navigates folder -> accesses offline files -> creates folder & upload offline -> restores connection -> synchronizes automatically -> verifies server and local database consistency -> `✓ Synced`.


# 💎 Jewel Suite — Offline-First Jewellery Shop ERP & POS

Jewel Suite is a standalone, offline-first Enterprise Resource Planning (ERP) and Point of Sale (POS) system designed for independent jewellery retail and wholesale operations running on a single local Windows computer.

---

## 1. System Architecture

The application strictly enforces a decoupled 3-tier offline architecture:

```text
React 18 + TypeScript (Vite)
            ↓ (Local HTTP / Proxy)
Node.js + Express (Localhost: 127.0.0.1:4500)
            ↓
Controllers & Middleware (Auth, Zod Validation, Centralized Errors)
            ↓
Domain & Service Layer (Jewellery Business Logic, Precision Math, Atomic Transactions)
            ↓
Repository Layer (Type-Safe SQLite Prepared Statements)
            ↓
SQLite Database (better-sqlite3 in WAL Mode)
            ↓
Local Database File (jewel-suite.db)
```

---

## 2. Development Setup

### Prerequisites
- Node.js `v20+` or `v22+` LTS
- npm `v10+` or `v11+`
- Windows 10/11 (or macOS/Linux for development)

### Step 1: Install Dependencies
Install dependencies for both backend and frontend:
```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### Step 2: Start Backend Server
From the project root or `backend/`:
```bash
npm run dev:backend
# or inside backend/: npm run dev
```
The server will start at `http://127.0.0.1:4500`.

### Step 3: Start Frontend Terminal
From the project root or `frontend/`:
```bash
npm run dev:frontend
# or inside frontend/: npm run dev
```
The frontend terminal will open at `http://127.0.0.1:5173`.

---

## 3. Database Architecture & Operations

### Where the SQLite DB is Created
- **Development Mode (`NODE_ENV=development`):**
  Located inside the local project folder at:
  ```text
  ./data/jewel-suite.db
  ```
- **Production Mode (`NODE_ENV=production` on Windows):**
  Stored in the user application data directory so that application updates or uninstalls never wipe shop business records:
  ```text
  %LOCALAPPDATA%\JewelSuite\data\jewel-suite.db
  ```

### How Migrations Run
1. When the backend boots (`server.ts` -> `bootstrapApp()`), the migration runner checks for the `schema_migrations` table.
2. It discovers all versioned SQL files in `backend/src/database/migrations/` (e.g. `001_initial_schema.sql`).
3. Any unapplied migrations are executed inside an **atomic SQLite transaction**.
4. Executed migrations are recorded with their timestamp.
5. The application will never re-execute already applied migrations.

### How to Reset Development Database
To completely reset the development database to a fresh state:
1. Stop the backend server (`Ctrl + C`).
2. Delete the database files in `./data/`:
   ```bash
   rm data/jewel-suite.db*
   ```
3. Restart the backend: `npm run dev:backend`.
4. The migration runner and seeders will automatically recreate the clean database with default tables and master admin.

---

## 4. Authentication Foundation

- **Zero Cloud Dependency:** Authentication runs 100% offline using local SQLite records.
- **Password Security:** Plaintext passwords are never stored; they are hashed using `bcrypt` (10 rounds).
- **Auto-Bootstrapping Admin:** When the application runs for the first time and detects 0 registered users, it automatically provisions the master administrator account:
  - **Username:** `admin`
  - **Password:** `admin123`
  - **Role:** `Admin`
- **Session Tokens:** Stateless offline JWT tokens signed with a local machine secret.

---

## 5. Transaction Infrastructure

All multi-table mutations (sales, stock deductions, ledger updates, karigar issuance) are protected by SQLite's Write-Ahead Logging (`WAL`) mode and atomic transactions:

```typescript
import { withTransaction } from './database/connection/db';

withTransaction((db) => {
  // 1. Create Invoice
  // 2. Deduct Stock Item
  // 3. Insert Stock Movement Audit
  // 4. Create Customer Ledger Debit
  // If ANY operation fails, the entire transaction is automatically ROLLED BACK.
});
```

---

## 6. Running Tests

The test suite validates:
1. SQLite connection and foreign key pragmas.
2. Migration execution and idempotency.
3. User creation and repository persistence.
4. Password hashing and verification.
5. Login authentication success and JWT creation.
6. Login failure and rejection of deactivated users.
7. Shop, Settings, and Audit Log CRUD.
8. Atomic transaction rollback verification.
9. HTTP endpoints integration (`/api/system/health`, `/api/auth/login`, `/api/auth/me`).

Run tests from the root or `backend/`:
```bash
npm run test
```

---

## 7. Next Roadmap: Part 2 — Inventory & Stock Model
Following the completion and verification of Part 1, Part 2 will implement:
- Jewellery category & product catalogue.
- Tag-level stock items (Gross, Less, Net, Tunch %, Fine Weight, Wastage %, Making Charges).
- Immutable stock movement audit trail.
- Real-time stock valuation based on daily metal rates.

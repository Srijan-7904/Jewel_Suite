# 🚀 Hosting Jewel Suite on Render (Complete Guide)

This guide walks you through deploying **Jewel Suite Gold & Diamond ERP / POS** on [Render](https://render.com).

---

## 📌 Architecture Overview

Jewel Suite can be deployed on Render in **two recommended configurations**:

| Option | Architecture | Plan / Cost | Persistence | Best For |
|---|---|---|---|---|
| **Option A (Recommended)** | **Full-Stack Unified Service + Persistent Disk** via `render.yaml` | Starter ($7/mo) | ✅ Persistent SSD (`/var/data`) | Real store production; SQLite WAL data and invoices are 100% preserved |
| **Option B (Zero-Cost Free Tier)** | **Unified Single Web Service** | Free ($0/mo) | ⚠️ Ephemeral (resets on spin-down) | Demos, client previews, staging, testing |
| **Option C (Split Architecture)** | **Backend Web Service + Dedicated Static Site CDN** | Free / Starter | Optional Disk on API | Decoupled CDN static asset hosting |

> [!TIP]
> **Why Option A is recommended for Jewellery Stores**:
> Jewel Suite uses SQLite with Write-Ahead Logging (WAL) for offline-first transactional integrity. Because cloud containers have ephemeral disks by default, attaching a **Render Persistent Disk** ensures your sales invoices, customer balances, stock items, and Girvi loan records are never lost when the server restarts or deploys.

---

## 🛠️ Option A: 1-Click Blueprint Deployment (Recommended)

Render Blueprints let you spin up all required services automatically using the provided [`render.yaml`](./render.yaml).

### Step 1: Push Code to GitHub / GitLab
Make sure your latest codebase with [`render.yaml`](./render.yaml) is pushed to your Git repository:
```bash
git add .
git commit -m "feat: add Render blueprint and production cloud hosting configuration"
git push origin main
```

### Step 2: Open Render Dashboard
1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click the **"New +"** button in the top right.
3. Select **"Blueprint"**.

### Step 3: Connect Your Repository
1. Select your Git provider (GitHub / GitLab) and authorize access to your repository.
2. Select your `Jewel` repository.
3. Render will automatically detect [`render.yaml`](./render.yaml) in the root directory.

### Step 4: Review and Deploy
Render will display the services detected in the blueprint:
- **`jewel-suite-app`** (Web Service, Node.js runtime, Starter plan with 1GB persistent disk at `/var/data`)
- **`jewel-suite-frontend`** (Static Site, global CDN)

Click **"Apply"**. Render will build and deploy both services!

---

## 🆓 Option B: Free Tier Deployment ($0/month)

If you want to host on Render's **Free Tier** for demonstration or testing:

1. Open [`render.yaml`](./render.yaml).
2. For `jewel-suite-app`:
   - Change `plan: starter` to `plan: free`.
   - Remove or comment out the `disk:` block:
     ```yaml
     # disk:
     #   name: jewel-data
     #   mountPath: /var/data
     #   sizeGB: 1
     ```
   - Change `DB_FILE_PATH` to `./data/jewel-suite.db`.
   - Change `APP_DATA_DIR` to `./data`.
3. Commit and push to GitHub.
4. Deploy via **New + -> Blueprint** on Render.

> [!NOTE]
> On the free tier, Render spins down free web services after 15 minutes of inactivity. The first request after spin-down may take ~30–50 seconds to cold start.

---

## 🖥️ Option C: Manual Setup (Without Blueprint)

If you prefer to configure services manually in the Render dashboard:

### 1. Backend Web Service
1. In Render Dashboard, click **New + -> Web Service**.
2. Connect your Git repository.
3. Configure settings:
   - **Name**: `jewel-suite-api`
   - **Region**: Choose the closest region (e.g., Singapore, Frankfurt, Oregon, Ohio).
   - **Branch**: `main`
   - **Root Directory**: `.` (leave blank or `.`)
   - **Runtime**: `Node`
   - **Build Command**: `npm run render:build:all`
   - **Start Command**: `npm run render:start:all`
   - **Instance Type**: `Starter` (to attach disk) or `Free`
4. **Environment Variables**:
   | Variable | Value | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Production mode |
   | `PORT` | `10000` | Port automatically routed by Render |
   | `HOST` | `0.0.0.0` | Bind to all network interfaces |
   | `JWT_SECRET` | *(Click "Generate")* | Cryptographic token signature secret |
   | `JWT_EXPIRES_IN` | `7d` | Token validity |
   | `APP_DATA_DIR` | `/var/data` | Storage directory for persistent disk |
   | `DB_FILE_PATH` | `/var/data/jewel-suite.db` | SQLite database file location |
   | `BACKUP_DIR` | `/var/data/backups` | Database backups folder |
5. **Add Persistent Disk** (Under *Disks* tab):
   - **Name**: `jewel-data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (or larger as your inventory grows)
6. Click **Create Web Service**.

### 2. Frontend Static Site (Optional)
If you also want the dedicated CDN frontend:
1. Click **New + -> Static Site**.
2. Connect your Git repository.
3. Configure settings:
   - **Name**: `jewel-suite-frontend`
   - **Branch**: `main`
   - **Build Command**: `npm run render:build:frontend`
   - **Publish Directory**: `frontend/dist`
4. Under **Redirects/Rewrites**:
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`
5. Under **Environment Variables**:
   - `VITE_API_URL`: `https://jewel-suite-api.onrender.com` (your backend URL)
6. Click **Create Static Site**.

---

## 🔑 Default Administrator Login

Once the deployment finishes and the service status is **Live**:

1. Open your Render application URL (e.g., `https://jewel-suite-app.onrender.com`).
2. Log in with the default seeded administrator credentials:
   - **Username**: `admin`
   - **Password**: `admin123`
3. ⚠️ **Immediate Security Action**: Go to **Settings (`/system/settings`) -> Staff & Users** and update the administrator password.

---

## 🩺 Health Check & Monitoring

Render uses the `/health` endpoint configured in [`backend/src/server.ts`](./backend/src/server.ts) to verify the service status:
```
GET https://your-app.onrender.com/health
```
Response:
```json
{
  "status": "ok",
  "service": "jewel-suite-backend",
  "timestamp": "2026-10-18T10:00:00.000Z",
  "database": "connected"
}
```

---

## 🌐 Custom Domains & SSL

1. In Render, open your service (`jewel-suite-app`).
2. Go to **Settings -> Custom Domains**.
3. Add your domain or subdomain (e.g., `pos.myjewellerystore.com`).
4. Update your DNS provider with the `CNAME` or `A` record provided by Render.
5. Render will automatically issue and renew a free Let's Encrypt SSL/TLS certificate.

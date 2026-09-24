# FTM Garments — Dispatch & Warehouse Tracking System

Tracks carton receiving, outbound truck dispatch, schedule imports, and reporting for customers MRP, OTB, and OBSW.

---

## Features

- XML (.mrpg) and manual shipment import
- Barcode scan-in and scan-out with per-carton timestamps
- Truck shipment records with manifest and export
- Previous Year Orders (legacy stock) tracking and outbound shipping
- Dashboard with year filter and KPI cards
- Weekly analysis by delivery schedule week
- Reports: comprehensive, inventory, time-based, daily summary, daily entry chart
- CSV and PDF exports (server-side mPDF + client-side jsPDF)
- Schedule upload, activation, and linking to shipments
- Admin user management with audit log and password reset
- App settings: sidebar visibility toggles
- Scan sessions with per-PO progress tracking

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 (CRA), Bootstrap 5, Chart.js, Quagga, jsPDF |
| Backend | PHP 8+, REST API |
| Database | MySQL / MariaDB 10.11 |
| PDF | mPDF (server-side), jsPDF (client-side) |
| Process manager (prod) | pm2 + nginx |

---

## Windows Development Setup

### 1. Prerequisites

- [XAMPP](https://www.apachefriends.org) — provides PHP and MySQL
- [Node.js LTS](https://nodejs.org)
- [Git](https://git-scm.com)
- Composer (optional — only needed for mPDF PDF reports)

Add PHP to PATH: `C:\xampp\php`

Verify:
```powershell
php -v          # 8.x
node -v         # 18+
npm -v
```

### 2. Clone and install

```powershell
git clone <repository-url>
cd dispatch
cd frontend && npm install && cd ..
cd backend && composer install && cd ..   # optional, for PDF reports
```

### 3. Set up the database

Start MySQL in the XAMPP Control Panel, then:

```powershell
php backend/config/init_db.php
```

This creates the `warehouse_tracking` database and runs all 20 migrations in one step.

### 4. Create the admin user

```powershell
php backend/create_admin_user.php
```

Default credentials: `admin` / `ChangeMe!123` — change after first login.

Override with env vars:
```powershell
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = "YourPassword"
$env:ADMIN_EMAIL    = "admin@ftmswaziland.com"
php backend/create_admin_user.php
```

### 5. Start the system

Two terminal windows:

```powershell
# Terminal 1 — backend (port 8001)
php backend/start_server.php

# Terminal 2 — frontend (port 3000)
cd frontend
npm start
```

Open http://localhost:3000

Or use the launcher:
```powershell
start_all.bat
```

---

## Linux / Production Setup

### 1. Install system packages

```bash
apt install php php-fpm php-mysql php-mbstring php-xml php-zip nginx mariadb-server composer
```

### 2. Create database user

```sql
CREATE USER 'ftm_user'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD';
GRANT ALL PRIVILEGES ON warehouse_tracking.* TO 'ftm_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Set environment variables

In `/etc/php/8.x/fpm/pool.d/www.conf`:

```ini
env[DB_HOST]               = localhost
env[DB_NAME]               = warehouse_tracking
env[DB_USER]               = ftm_user
env[DB_PASS]               = YOUR_PASSWORD
env[CORS_ALLOWED_ORIGINS]  = http://YOUR_SERVER_IP
env[ADMIN_ACTION_CODE]     = YOUR_CHOSEN_CODE
```

### 4. Build the frontend

```bash
echo "REACT_APP_API_URL=http://YOUR_SERVER_IP/api" > frontend/.env.production
cd frontend && npm install && npm run build
```

### 5. Nginx config

```nginx
server {
    listen 80;
    root /var/www/dispatch/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        root /var/www/dispatch/backend;
        fastcgi_pass unix:/run/php/php8.x-fpm.sock;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /var/www/dispatch/backend$fastcgi_script_name;
    }

    location = /unlock_admin.php { deny all; }
}
```

### 6. File permissions

```bash
mkdir -p backend/uploads backend/cache
chown -R www-data:www-data backend/uploads backend/cache
chmod 755 backend/uploads backend/cache
```

### 7. Database setup

```bash
php backend/config/init_db.php
```

Creates the database and runs all migrations automatically.

### 8. Create admin user

```bash
DB_HOST=localhost DB_NAME=warehouse_tracking DB_USER=ftm_user DB_PASS=YOUR_PASSWORD \
ADMIN_USERNAME=admin ADMIN_EMAIL=admin@ftmswaziland.com ADMIN_PASSWORD=YOUR_PASSWORD \
php backend/create_admin_user.php
```

### 9. Verify

- Log in as admin
- Upload a test .mrpg file
- Scan a carton in and out
- Open Finish Loading modal — should show manifest
- Export PDF and CSV from Reports

---

## After `git pull`

```powershell
php backend/database/migrate.php   # apply any new migrations
cd frontend && npm install          # if package.json changed
# restart both servers
```

---

## Database Migrations

All schema changes are tracked in `backend/database/migrations/`. Run the runner after pulling:

```bash
php backend/database/migrate.php
```

Each migration runs only once per database. To set up a fresh database from scratch, use `init_db.php` — it creates the database and runs all migrations in one step.

Current migrations: 20 applied (001–020), covering all tables.

---

## Project Structure

```
backend/
  api/           API endpoints (~50 PHP files)
  config/        database.php, init_db.php, cors.php
  database/      migrate.php + migrations/
  includes/      shared PHP helpers
  uploads/       imported .mrpg XML files
  cache/         PHP file cache (auto-generated)
frontend/
  src/
    pages/       React page components
    components/  Shared UI components
    contexts/    Auth and theme contexts
    services/    axios wrapper, auth service
database_schema.sql   Full schema reference (auto-generated — use migrate.php for setup)
PROGRESS.md           Session-by-session change log
start_all.bat         Windows dev launcher
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `php` not found | Add `C:\xampp\php` to PATH |
| DB connection failed | Check MySQL is running; check env vars |
| Migration fails: table missing | Run `php backend/config/init_db.php` first |
| Login fails with correct password | Run `php backend/create_admin_user.php` then `php backend/unlock_admin.php` |
| Port 8001 in use | Edit `$port` in `backend/start_server.php` |
| CORS errors in browser | Ensure backend is running before opening frontend |
| PDF reports fail | Run `composer install` in `backend/` |

---

## Admin Notes

- **Admin code** (`ADMIN_ACTION_CODE` env var) — required for destructive actions: delete PO, delete user, change app settings. Set in env, not in code.
- **Password reset** — Settings → Users → key icon next to any user.
- **Employee scanner** — `/employee-login` — uses employee codes, not system user accounts.
- **Unlock admin** — CLI only: `php backend/unlock_admin.php` (blocked from web).

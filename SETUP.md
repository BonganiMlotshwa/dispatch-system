# Setup Guide — FTM Garments Dispatch System

Complete instructions for installing and running the system on a **new computer**. Follow the steps in order.

---

## What You Are Setting Up

This project has two parts:

| Component | Technology | Default URL |
|-----------|------------|-------------|
| **Backend** | PHP + MySQL | http://localhost:8001 |
| **Frontend** | React (Node.js) | http://localhost:3000 |

The frontend talks to the backend API on port **8001**.

---

## 1. Install Dependencies

Everything the system needs falls into four groups: **PHP**, **MySQL**, **Node.js**, and **Git**. On Windows, the easiest way to get PHP and MySQL together is **XAMPP**.

### Dependency overview

| Dependency | Version | Purpose | How it is installed |
|------------|---------|---------|---------------------|
| **PHP** | 7.4+ (8.x OK) | Runs the backend API | XAMPP, or standalone PHP |
| **MySQL** | 5.7+ / MariaDB 10.3+ | Stores all application data | XAMPP, or standalone MySQL |
| **Node.js** | 14.x+ (LTS recommended) | Runs the React frontend | nodejs.org installer |
| **npm** | 6.x+ (bundled with Node) | Installs frontend packages | Comes with Node.js |
| **Git** | Any recent | Clone the repository | git-scm.com |
| **Composer** | Optional | PHP package manager (PDF reports) | getcomposer.org |

### PHP extensions required

The backend needs these PHP extensions (all included in a standard XAMPP install):

| Extension | Used for |
|-----------|----------|
| `pdo_mysql` | Database connection |
| `json` | API request/response handling |
| `mbstring` | String handling |
| `session` | User authentication |
| `xml` / `simplexml` | XML file imports |

Verify after install:

```powershell
php -m
```

Look for `pdo_mysql` in the list. If it is missing, enable it in `php.ini` (in XAMPP: `C:\xampp\php\php.ini`) by uncommenting:

```ini
extension=pdo_mysql
```

---

### Option A — Windows with XAMPP (recommended)

XAMPP bundles PHP, MySQL, and Apache in one installer.

#### 1. Install XAMPP

1. Download from https://www.apachefriends.org (PHP 8.x build)
2. Run the installer
3. Install to `C:\xampp` (default)
4. Select **Apache**, **MySQL**, and **PHP** during setup

#### 2. Start MySQL

1. Open **XAMPP Control Panel**
2. Click **Start** next to **MySQL**
3. The MySQL row should turn green — leave it running while you use the app

> Apache is **not** required for development. The backend uses PHP's built-in server on port 8001.

#### 3. Add PHP to your PATH (recommended)

This lets you run `php` from any terminal instead of typing the full path.

1. Press **Win + S**, search **Environment Variables**, open **Edit the system environment variables**
2. Click **Environment Variables**
3. Under **User variables**, select **Path** → **Edit** → **New**
4. Add: `C:\xampp\php`
5. Click **OK** on all dialogs
6. **Close and reopen** PowerShell, then verify:

```powershell
php -v
```

Expected output (version may differ):

```
PHP 8.2.x (cli) ...
```

If `php` is still not found, use the full path in all commands:

```powershell
C:\xampp\php\php.exe backend/start_server.php
```

#### 4. Install Node.js

1. Download the **LTS** installer from https://nodejs.org
2. Run the installer (keep default options — npm is included)
3. Close and reopen PowerShell, then verify:

```powershell
node -v
npm -v
```

#### 5. Install Git

1. Download from https://git-scm.com/download/win
2. Run the installer (defaults are fine)
3. Verify:

```powershell
git --version
```

#### 6. Install Composer (optional)

Only needed if you use PDF report features that depend on `mpdf`:

1. Download from https://getcomposer.org/download/
2. Run **Composer-Setup.exe** — it will detect your PHP path from XAMPP
3. Verify:

```powershell
composer --version
```

---

### Option B — macOS

```bash
# Using Homebrew (https://brew.sh)
brew install php mysql node git composer

# Start MySQL
brew services start mysql
```

---

### Option C — Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install php php-mysql php-mbstring php-xml mysql-server nodejs npm git composer

# Start MySQL
sudo systemctl start mysql
sudo systemctl enable mysql
```

---

### Verify all dependencies

Run this checklist before continuing. Every command should succeed:

```powershell
php -v          # PHP 7.4 or higher
php -m          # includes pdo_mysql
node -v         # v14 or higher
npm -v          # v6 or higher
git --version   # any recent version
```

MySQL must be running (XAMPP Control Panel → MySQL → Start).

---

## 2. Get the Project

```powershell
git clone <repository-url>
cd dispatch-system
```

Or copy/unzip the project folder to a location such as `C:\Sec\dispatch-system`.

All remaining commands assume you are in the **project root** — the folder that contains `backend/` and `frontend/`.

---

## 3. Configure the Database Connection

Before creating the database, set your MySQL credentials in `backend/config/database.php`:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'warehouse_tracking');
define('DB_USER', 'root');
define('DB_PASS', '');   // Empty is the XAMPP default
```

| Setting | XAMPP default | Change if… |
|---------|---------------|------------|
| `DB_HOST` | `localhost` | MySQL runs on another machine |
| `DB_NAME` | `warehouse_tracking` | You want a different database name |
| `DB_USER` | `root` | You created a dedicated MySQL user |
| `DB_PASS` | `''` (empty) | Your MySQL root account has a password |

---

## 4. Create and Migrate the Database

The database is set up in **two steps**. Both are required on a new computer.

```
Step 1: init_db.php     →  Creates the database + base tables
Step 2: migrate.php     →  Applies all schema updates on top
```

### What each step does

| Step | Script | What it creates |
|------|--------|-----------------|
| **1 — Initialize** | `backend/config/init_db.php` | Creates the `warehouse_tracking` database and base tables from `backend/config/schema.sql` |
| **2 — Migrate** | `backend/database/migrate.php` | Runs pending migration files from `backend/database/migrations/` and records them in `schema_migrations` |

**Base tables** created by init (Step 1):

- `shipments` — PO / shipment records
- `cartons` — individual carton tracking
- `users` — admin login accounts

**Additional tables/columns** added by migrations (Step 2):

| Migration file | What it adds |
|----------------|--------------|
| `001_customer_support` | Customer, style, color, order qty, entry type columns on shipments |
| `002_truck_shipments` | `truck_shipments`, `truck_shipment_items`, `scan_audit_log` tables; scan columns on cartons |
| `003_employees` | `employees`, `employee_sessions` tables; sample employee codes |
| `004_driver_workflow` | Truck shipment linking on cartons and audit log |
| `005_shipment_warehouse_status` | Warehouse order status on shipments |
| `006_truck_loading_status` | Loading status on truck shipments |
| `007_entry_exit_timestamps` | Entry and exit timestamps on cartons |
| `008_legacy_warehouse_goods` | Legacy warehouse goods table |
| `009_legacy_status_spec15` | Legacy status spec update |

Migrations are **tracked** — each one runs only once per database. The runner stores completed migrations in the `schema_migrations` table.

---

### Step 4a — Create the database and base tables

Make sure **MySQL is running**, then from the project root:

```powershell
php backend/config/init_db.php
```

**Expected output:**

```
Database 'warehouse_tracking' created or already exists.
Database schema initialized successfully.
Database setup completed successfully.
```

If tables already exist, you will see `Tables already exist. Skipping schema creation.` — that is fine.

**What happens behind the scenes:**

1. Connects to MySQL as `root`
2. Runs `CREATE DATABASE IF NOT EXISTS warehouse_tracking`
3. Executes `backend/config/schema.sql` to create `shipments`, `cartons`, and `users`

---

### Step 4b — Run migrations

Still from the project root:

```powershell
php backend/database/migrate.php
```

**Expected output (first run on a new database):**

```
========================================
Tracked Migration Runner
========================================

Running: 20260526_001_customer_support.php
--------------------------------------------------
...
Recorded migration: 20260526_001_customer_support.php

Running: 20260526_002_truck_shipments.php
--------------------------------------------------
...

========================================
Migration Summary
========================================
Applied: 9
Failed: 0
Already applied: 0
========================================
```

On subsequent runs (or after pulling code with no new migrations):

```
No pending migrations.
```

**Alternative entry point** (same runner):

```powershell
php backend/run_all_migrations.php
```

---

### Step 4c — Verify the database

You can confirm everything is in place using phpMyAdmin or the command line.

**phpMyAdmin (XAMPP):**

1. Open http://localhost/phpmyadmin
2. Click the `warehouse_tracking` database in the left sidebar
3. You should see tables including: `shipments`, `cartons`, `users`, `employees`, `truck_shipments`, `schema_migrations`

**Command line:**

```powershell
php -r "require 'backend/config/database.php'; $p=getDbConnection(); foreach($p->query('SHOW TABLES') as $r) echo implode('',$r).PHP_EOL;"
```

You should see at least 10 tables. The `schema_migrations` table should contain 9 rows after a fresh install.

---

### Full database setup — copy-paste block

Run these three commands in order from the project root:

```powershell
php backend/config/init_db.php
php backend/database/migrate.php
php backend/create_admin_user.php
```

---

## 5. Create the Admin User

```powershell
php backend/create_admin_user.php
```

Default credentials:

| Field | Value |
|-------|-------|
| **Username** | `admin` |
| **Password** | `ChangeMe!123` |
| **Email** | `admin@example.com` |

Override with environment variables (PowerShell):

```powershell
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = "YourSecurePassword"
$env:ADMIN_EMAIL = "admin@yourcompany.com"
php backend/create_admin_user.php
```

Re-running this script updates the password if the admin user already exists.

---

## 6. Install Project Dependencies

### Frontend (required)

```powershell
cd frontend
npm install
cd ..
```

This reads `frontend/package.json` and installs all React dependencies into `frontend/node_modules/`. Main packages include:

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI framework |
| `react-router-dom` | Page navigation |
| `axios` | API calls to the backend |
| `bootstrap` / `react-bootstrap` | UI styling |
| `chart.js` / `react-chartjs-2` | Dashboard charts |
| `quagga` | Barcode scanning |
| `jspdf` | PDF export |

Only needs to be run once, or again after `package.json` changes.

### Backend PHP packages (optional)

For PDF report generation via `mpdf`:

```powershell
cd backend
composer install
cd ..
```

This creates `backend/vendor/` from `backend/composer.json`.

---

## 7. Start the System

You need **two terminal windows** — one for the backend, one for the frontend.

### Terminal 1 — Backend (port 8001)

From the project root:

```powershell
php backend/start_server.php
```

Leave this running. You should see:

```
Starting PHP development server at http://0.0.0.0:8001/
PHP Development Server (http://0.0.0.0:8001) started
```

### Terminal 2 — Frontend (port 3000)

```powershell
cd frontend
npm start
```

The browser should open automatically at http://localhost:3000.

---

## 8. Log In

1. Open http://localhost:3000
2. Sign in with:
   - **Username:** `admin`
   - **Password:** `ChangeMe!123`

---

## Quick Reference — Daily Startup

Once everything is installed:

```powershell
# 1. Start MySQL (XAMPP Control Panel → Start MySQL)

# Terminal 1 — backend
php backend/start_server.php

# Terminal 2 — frontend
cd frontend
npm start
```

---

## URLs & Ports

| Service | URL | Port |
|---------|-----|------|
| Frontend (app) | http://localhost:3000 | 3000 |
| Backend API | http://localhost:8001/api | 8001 |
| Backend root | http://localhost:8001 | 8001 |
| phpMyAdmin (XAMPP) | http://localhost/phpmyadmin | 80 |
| MySQL | localhost | 3306 |

The frontend automatically connects to `http://localhost:8001/api` when accessed via localhost (see `frontend/src/config.js`).

---

## Troubleshooting

### `php` is not recognized

PHP is not on your PATH. Either add `C:\xampp\php` to PATH (see Section 1), or use:

```powershell
C:\xampp\php\php.exe backend/start_server.php
```

### Database connection failed

- Confirm **MySQL is running** (XAMPP Control Panel → Start MySQL)
- Check username/password in `backend/config/database.php`
- Run `php backend/config/init_db.php` to create the database

### Migration fails — `Table 'warehouse_tracking.shipments' doesn't exist`

You skipped Step 4a. Run init before migrate:

```powershell
php backend/config/init_db.php
php backend/database/migrate.php
```

### Migration fails — tablespace error

The database has orphaned files from a previous broken install. **This deletes all data:**

```powershell
php -r "require 'backend/config/database.php'; $p=new PDO('mysql:host='.DB_HOST.';charset=utf8mb4',DB_USER,DB_PASS); $p->exec('DROP DATABASE IF EXISTS `'.DB_NAME.'`'); $p->exec('CREATE DATABASE `'.DB_NAME.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'); echo 'Database recreated.'.PHP_EOL;"
php backend/config/init_db.php
php backend/database/migrate.php
php backend/create_admin_user.php
```

### Login shows "Login failed" with correct password

```powershell
php backend/create_admin_user.php
php backend/unlock_admin.php
```

Also confirm the backend is running on port 8001 and hard-refresh the browser (Ctrl+Shift+R).

### Port 8001 or 3000 already in use

- Backend: edit `$port` in `backend/start_server.php`
- Frontend: `$env:PORT = "3001"` before `npm start`

### Frontend `npm install` fails

```powershell
cd frontend
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### CORS or network errors in the browser

- Backend must be running before you open the frontend
- Use `http://localhost:3000` (not `127.0.0.1:3000`) so the API URL matches

---

## Employee Scanner Login

Sample employee codes created by migration `003_employees`:

| Code | Name | Role |
|------|------|------|
| EMP001 | Mkhaya | Scanner |
| EMP002 | Thabo | Scanner |
| EMP003 | Sipho | Scanner |
| ADMIN01 | Admin User | Admin |

Employee login: http://localhost:3000/employee-login

---

## Updating After `git pull`

```powershell
php backend/database/migrate.php
cd frontend
npm install
cd ..
# Restart both servers
```

---

## Complete Setup Checklist

Use this to confirm a new machine is ready:

- [ ] XAMPP installed, MySQL started
- [ ] PHP on PATH — `php -v` works
- [ ] Node.js installed — `node -v` and `npm -v` work
- [ ] Project cloned/copied to disk
- [ ] `backend/config/database.php` credentials set
- [ ] `php backend/config/init_db.php` — base tables created
- [ ] `php backend/database/migrate.php` — 9 migrations applied
- [ ] `php backend/create_admin_user.php` — admin account ready
- [ ] `cd frontend && npm install` — frontend packages installed
- [ ] `php backend/start_server.php` — backend running on :8001
- [ ] `npm start` in frontend — app open on :3000
- [ ] Login works with `admin` / `ChangeMe!123`

---

## Support

1. Check this guide and `README.md` for feature documentation
2. Check the browser developer console (F12) for frontend errors
3. Check the backend terminal window for PHP errors during API requests

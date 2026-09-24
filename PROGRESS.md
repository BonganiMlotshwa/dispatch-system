# Dispatch System — Progress Log

## Session 2026-09-23 — DONE ✓

### Security fixes (all backend)
- `active_trucks.php`, `close_truck_loading.php`, `quick_truck.php` — added `auth_require_user()` (were fully open)
- `scan_carton_v2.php` — auth was included but never enforced; added `auth_require_user()`
- `verify_admin.php` — added `auth_require_user()` (was publicly brute-forceable)
- `update_truck.php` — added `auth_is_admin()` guard (IDOR: any user could edit any truck)
- `admin_auth.php` — `ADMIN_ACTION_CODE` moved to env var (was hardcoded in source)
- `unlock_admin.php` — blocks web requests via `php_sapi_name() !== 'cli'`
- `delete_po.php`, `update_po_number.php` — removed all debug `error_log` with raw user input
- `update_shipment_details.php` — DB exception detail no longer sent to client
- `xml_parser.php` — added `libxml_use_internal_errors(true)` to suppress path leaks

### Linux migration prep (code changes — server steps tomorrow)
- `upload.php` — `'../uploads/'` → `__DIR__ . '/../uploads/'` (absolute path)
- `config.js` — reads `REACT_APP_API_URL` env var; fallback drops `:8001` for non-localhost
- `database.php` — all 4 DB params now via `getenv()` with local fallbacks
- `cors.php` — reads `CORS_ALLOWED_ORIGINS` env var (comma-separated) for production origins
- `reports.php` (logo) — fallback path to `backend/assets/` if `frontend/public/` not present
- `create_admin_user.php` — fixed to write `password` column not orphaned `password_hash`
- Migration `20260923_019_drop_password_hash.php` — drops orphaned `password_hash` from users

### Bug fixes
- `truck_manifest.php` — wrong column `lg.order_number` → `lg.internal_po` (was causing "Finish Loading" to silently fail)
- `CartonScanner.js` — Finish Loading modal now stays open on error with message + Retry button; removed `withCredentials: true`
- `ExitScanModal.js` — Week field now uses ISO week-of-year (was week-of-month: showed Wk4 instead of Wk39)
- `LegacyWarehouseGoods.js` — Status filter defaults to All statuses (was Active)
- `reports.php` — Comprehensive PDF now includes Customer column to match CSV export

### Truck confirmation lock
- `truck_shipment.php` PUT — rejects edits on `loading_status = 'closed'` trucks for non-admins (403)
- `truck_summary.php` — returns `loading_status` in truck rows
- `TruckSummary.js` — edit button shows lock icon for confirmed trucks (non-admins); admins see pencil with warning banner in modal

---

## Session 2026-09-24 — DONE ✓

### Database housekeeping
- Migration 019 (`drop_password_hash`) applied — was written last session but never ran; `password_hash` column now dropped from live `users` table
- Migration 020 (`app_settings`) created and applied — `app_settings` table now tracked in migration system (was created manually, would have been missing on fresh Linux install)
- `database_schema.sql` regenerated from live DB — now accurate with all 17 tables and correct columns; previously was missing 14 tables and still referenced `password_hash`

### Project cleanup (commit 58c8ad27)
- Deleted 25 stale files:
  - `warehouse_tracking (5).sql` — old DB dump with `password_hash`
  - `backend/config/schema.sql` — stale 3-table schema, dangerous if run on Linux
  - 12 one-time `migrate_*.php` scripts in backend root (superseded by `backend/database/migrations/`)
  - `backend/run_all_migrations.php` — wrapper, no longer needed; use `php backend/database/migrate.php`
  - `backend/sync_all_shipment_statuses.php`, `backend/fix_reset_auto_shipped_status.php`, `backend/check_orders.php` — one-time fix/debug scripts
  - `debug_log.txt`, `newdbcol.txt` — junk files
  - 6 extra `.md` docs consolidated into `README.md`
  - `backend/database/README.md`
- `backend/config/init_db.php` rewritten — now creates DB and calls `runDatabaseMigrations()` directly; no longer depends on deleted `schema.sql`. One command sets up a fresh server: `php backend/config/init_db.php`
- `README.md` consolidated — single file covering features, Windows dev setup, Linux production setup, migrations, troubleshooting, admin notes

### start_all.bat (commit 34ea1600)
- Rewritten to run everything in **one window** instead of spawning multiple cmd windows
- PHP backend runs via `start /B` (background, same console session)
- React runs in the foreground — output shows in this window
- Ctrl+C stops both processes
- Removed port-finder (no longer needed with single window)

---

### Portable start_all.bat (commit 9dba76ea)
- `ROOT` was hardcoded to `C:\xampp\htdocs\USB Drive\dispatch`; rewritten to use `%~dp0` so the batch file works from any folder location on any machine

---

## Session 2026-09-24 — TODO (Linux server migration)

### Server setup steps (to do on the Linux box)
1. **Install dependencies**
   ```bash
   apt install php php-fpm php-mysql php-mbstring php-xml php-zip nginx mariadb-server composer
   ```

2. **Create DB user**
   ```sql
   CREATE USER 'ftm_user'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD';
   GRANT ALL PRIVILEGES ON warehouse_tracking.* TO 'ftm_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

3. **Set env vars** in `/etc/php/8.x/fpm/pool.d/www.conf`:
   ```
   env[DB_HOST]              = localhost
   env[DB_NAME]              = warehouse_tracking
   env[DB_USER]              = ftm_user
   env[DB_PASS]              = YOUR_PASSWORD
   env[CORS_ALLOWED_ORIGINS] = http://YOUR_SERVER_IP
   env[ADMIN_ACTION_CODE]    = YOUR_CHOSEN_CODE
   ```

4. **Build frontend**
   ```bash
   echo "REACT_APP_API_URL=http://YOUR_SERVER_IP/api" > frontend/.env.production
   cd frontend && npm install && npm run build
   ```

5. **Nginx config** — serve `frontend/build/` as static, proxy `/api` to php-fpm
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

6. **File permissions**
   ```bash
   mkdir -p backend/uploads backend/cache
   chown -R www-data:www-data backend/uploads backend/cache
   chmod 755 backend/uploads backend/cache
   ```

7. **Create DB and run all migrations**
   ```bash
   php backend/config/init_db.php
   ```
   *(Creates the database and runs all 20 migrations in one step)*

8. **Bootstrap admin user**
   ```bash
   ADMIN_USERNAME=admin ADMIN_EMAIL=admin@ftmswaziland.com ADMIN_PASSWORD=YOUR_PASSWORD \
   php backend/create_admin_user.php
   ```

9. **Block unlock_admin.php in nginx** — already included in step 5 nginx config above.

10. **Verify**
    - Log in as admin
    - Upload a test .mrpg file
    - Scan a carton in and out
    - Open Finish Loading modal — should show manifest
    - Export PDF and CSV from Reports — confirm columns match

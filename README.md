# FTM Garments Warehouse Tracking System

A warehouse tracking system for FTM Garments that manages carton receiving, shipment tracking, truck dispatch, schedule imports, and reporting for customers such as MRP, OTB, and OBSW.

## Features

- XML shipment import
- Manual shipment creation
- Barcode scanning for receiving and dispatch
- Separate scan in and scan out timestamps
- Shipment and carton detail pages
- Daily summary reporting
- Weekly analysis by delivery schedule
- Truck shipment and truck summary reports
- CSV and PDF exports
- Schedule upload, activation, and deletion
- Uploaded shipment file management
- Admin-protected shipment deletion

## Tech Stack

- Backend: PHP, MySQL
- Frontend: React, Bootstrap
- Reports: CSV, PDF

## Requirements

- XAMPP or another LAMP/WAMP stack
- PHP 7.4 or newer
- MySQL 5.7 or newer
- Node.js 14 or newer
- npm 6 or newer

## Project Setup

### 1. Clone the repository

```bash
git clone https://github.com/BonganiMlotshwa/dispatch-system.git
cd dispatch-system
```

### 2. Import the database

Use phpMyAdmin or MySQL CLI to import `database_schema.sql` from the project root.

```bash
mysql -u root -p < database_schema.sql
```

### 3. Run database migrations

After pulling new code, run the tracked migration runner to add or update schema changes safely.

```bash
php backend/database/migrate.php
```

If needed, the legacy runner is still available:

```bash
php backend/run_all_migrations.php
```

Recent schema updates include:

- `entry_timestamp` and `exit_timestamp` on cartons
- delivery schedule tracking
- shipment-to-schedule linking
- truck workflow status updates

### 4. Create an admin user

Open the admin creator in your browser:

```text
http://localhost:8001/create_admin_user.php
```

Default credentials:

- Username: `admin`
- Password: `admin123`

Change the password after first login.

### 5. Start the backend

```bash
cd backend
php start_server.php
```

The backend runs at `http://localhost:8001`.

### 6. Start the frontend

```bash
cd frontend
npm install
npm start
```

The frontend runs at `http://localhost:3000`.

## Usage

### Dashboard

- View carton totals
- See received, pending, and shipped counts
- Review recent activity and progress summaries

### Import shipments

- Go to `Import Data`
- Upload an XML file or schedule file
- Review the imported shipment and carton data

### Manual entry

- Go to `Manual Entry`
- Create shipments for customers without XML files
- Enter style, color, quantity, and carton details

### Barcode scanning

- Use entry scanning to receive cartons into the warehouse
- Use exit scanning to load cartons onto trucks
- Scan in and scan out timestamps are tracked separately

### Weekly analysis

- Open `Weekly Analysis`
- Review schedule weeks, expected cartons, received cartons, in-warehouse cartons, and shipped cartons

### Reports

- Daily summary
- Shipment detail exports
- Truck shipment exports
- Truck summary exports
- Goods received export

## Data Model

### Shipments

Stores shipment-level details such as customer, style, color, quantity, file name, and schedule linkage.

### Cartons

Stores carton-level tracking data including barcode, size, units, status, scan timestamps, QC number, finishing number, and truck linkage.

### Delivery schedules

Stores imported weekly schedule files and links them to shipments.

### Truck shipments

Stores dispatch records for truck loading and exit tracking.

## Key API Areas

- `backend/api/shipments.php`
- `backend/api/manual_entry.php`
- `backend/api/scan_carton_v2.php`
- `backend/api/schedule.php`
- `backend/api/dashboard_stats.php`
- `backend/api/truck_summary_export.php`
- `backend/api/truck_shipment_export.php`

## Project Structure

```text
backend/
  api/
  config/
  database/
  includes/
  uploads/
frontend/
  public/
  src/
database_schema.sql
README.md
```

## Troubleshooting

- If the backend fails to start, check PHP, MySQL, and port 8001.
- If the frontend fails to start, run `npm install` again inside `frontend`.
- If a new column is missing, run the migration runner again.
- If login fails, verify the admin account was created and not locked.

## Notes for Contributors

- Keep database migrations tracked in `backend/database/migrations/`.
- Update the README whenever a workflow or API changes in a user-visible way.
- Prefer the existing backend and frontend patterns when adding new features.

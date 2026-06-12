# FTM Garments Warehouse Tracking System

A comprehensive warehouse management system for tracking cartons, managing shipments, and monitoring inventory for FTM Garments. Supports multiple customers including MRP, OTB, and OBSW.

## 🚀 Features

### Core Functionality
- **Multi-Customer Support** - Handle shipments from MRP, OTB, OBSW, and other customers
- **XML Import** - Automated carton data import from XML files
- **Manual Entry** - Create shipments manually for customers without XML files
- **Barcode Scanning** - Track cartons through warehouse workflow
- **Real-time Dashboard** - Monitor inventory status and shipment progress
- **Daily Summary Reports** - View goods received, expected, and pending by date
- **Export Capabilities** - Generate CSV and PDF reports

### Workflow Management
- **Carton Status Tracking**
  - Pending: Cartons expected but not yet received
  - Entered: Cartons physically received in warehouse
  - Exited: Cartons shipped out
- **Exit Scanning with Driver Information**
  - Streamlined truck creation during exit scanning
  - Automatic driver and truck tracking
  - Links cartons to specific trucks for complete audit trail
- **Truck Summary & Reporting**
  - View all trucks by date or week
  - Filter by truck registration
  - See carton and unit counts per truck
  - Export individual truck reports (CSV/PDF)
- **QC & Finishing Numbers** - Track quality control and finishing processes
- **Search & Filter** - Find shipments and cartons quickly
- **Shipment Details** - View complete carton information per PO

## 📋 System Requirements

- **XAMPP** (or similar LAMP/WAMP stack)
  - PHP 7.4 or higher
  - MySQL 5.7 or higher
  - Apache 2.4 or higher
- **Node.js** 14.x or higher
- **npm** 6.x or higher

## 🛠️ Installation

### 1. Clone or Download the Project

```bash
git clone <repository-url>
cd warehouse-tracking-system
```

### 2. Database Setup

#### Option A: Using phpMyAdmin (Recommended)

1. Start XAMPP and ensure MySQL is running
2. Open phpMyAdmin: `http://localhost/phpmyadmin`
3. Click "Import" tab
4. Select `database_schema.sql` from the project root
5. Click "Go" to import

#### Option B: Using MySQL Command Line

```bash
mysql -u root -p < database_schema.sql
```

### 2b. Run Database Migrations After Pulling

If you pull new code and the app says a column is missing, run the tracked migrations against your local database:

Open **PowerShell**, **Command Prompt**, or the **XAMPP Shell** in the project folder, then paste:

```bash
php backend/database/migrate.php
```

This updates the database schema safely and records which migrations were already applied. If you prefer the legacy entry point, this also works:

```bash
php backend/run_all_migrations.php
```

Use this whenever new backend code introduces a schema change, such as `entry_timestamp` or `exit_timestamp`.

### 3. Create Admin User

Visit: `http://localhost:8001/create_admin_user.php`

This creates the default admin account:
- **Username:** admin
- **Password:** admin123

⚠️ **Important:** Change this password after first login!

### 4. Backend Configuration

The database configuration is in `backend/config/database.php`. Default settings:

```php
$host = 'localhost';
$dbname = 'warehouse_tracking';
$username = 'root';
$password = ''; // Usually empty for XAMPP
```

Update these if your MySQL credentials are different.

### 5. Start Backend Server

```bash
cd backend
php start_server.php
```

The backend will run on `http://localhost:8001`

### 6. Frontend Setup

```bash
cd frontend
npm install
npm start
```

The frontend will run on `http://localhost:3000`

## 📱 Usage

### Login

1. Navigate to `http://localhost:3000`
2. Login with admin credentials (admin/admin123)

### Dashboard

The dashboard shows:
- Total Cartons Expected
- Cartons Entered (received)
- Cartons Pending
- Cartons Shipped
- Recent shipments

### Import XML File

1. Click "Import Data" in sidebar
2. Select XML file from your computer
3. Click "Upload and Process"
4. System automatically creates shipment and carton records

### Manual Entry (for OTB/OBSW customers)

1. Click "Manual Entry" in sidebar
2. Fill in the form:
   - Customer (OTB/OBSW)
   - PO Number
   - Style, Color, Order Quantity
   - Cartons Expected
   - Units Expected
   - Cartons Received (optional)
3. Click "Create Shipment"

### Daily Summary

1. Click "Daily Summary" in sidebar
2. Select date to view
3. See breakdown by customer and PO:
   - Expected cartons/units
   - Entered today
   - Pending
4. Export to CSV or PDF

### View Shipment Details

1. Click "Purchase Orders" in sidebar
2. Click on any shipment to view details
3. See all cartons with status
4. Filter by status or size
5. Export carton list to CSV/PDF

### Barcode Scanner

#### Entry Scanning (Receiving)
1. Click "Barcode Scanner" in sidebar
2. Enter PO number to validate
3. Scan carton barcode (or enter manually)
4. System updates carton status to "entered"
5. **Floating counter** shows session scans in real-time
6. View scan history

#### Exit Scanning (Dispatch)
1. Click "Barcode Scanner" in sidebar
2. Click "Exit Warehouse" button
3. Enter driver and truck information:
   - Truck Registration (e.g., ABC 123 GP)
   - Driver First Name
   - Driver Surname
   - Employee Pin (e.g., 12901)
   - Shipment Date (defaults to today)
   - Week (e.g., Wk16)
4. Click "Start Scanning"
5. Modal closes - you're back on scanner page
6. See active truck banner at top
7. Enter PO number and scan cartons normally
8. **Floating counter** updates with each scan
9. Each scan automatically links to the truck
10. Click "Finish Loading" when complete

**Floating Scan Counter:**
- 📊 Shows real-time count of scans in current session
- 📦 Displays total cartons and units scanned
- ✨ Pulses green with each successful scan
- 🔄 Click to reset counter (with confirmation)
- 🎯 Helps avoid delays and mismatches

**Benefits:**
- Complete driver accountability
- Automatic truck-to-carton linking
- Full audit trail for dispatch
- Real-time scan tracking
- Uses familiar scanner interface

### Truck Summary

View and analyze all truck shipments with filtering options:

1. Click "Truck Summary" in sidebar
2. Use filters to narrow down results:
   - **Date Range** - Filter by start and end date
   - **Week** - Select specific week (e.g., Wk10, Wk16)
   - **Truck Registration** - Search by truck number
3. View summary cards showing:
   - Total trucks loaded
   - Total cartons shipped
   - Total units shipped
4. See detailed table with:
   - Date and week
   - Truck registration and driver
   - Customers served
   - Number of POs
   - Carton and unit counts
5. Export individual truck reports (CSV or PDF)

**Use Cases:**
- "How many trucks did we load in Week 10?"
- "Which trucks left on 2026-05-10?"
- "How many cartons did truck ABC123 carry?"
- "What was our total output for last week?"

## 🗂️ Project Structure

```
warehouse-tracking-system/
├── backend/
│   ├── api/                    # API endpoints
│   │   ├── daily_summary.php   # Daily summary data
│   │   ├── manual_entry.php    # Manual shipment creation
│   │   ├── shipments.php       # Shipment CRUD operations
│   │   └── ...
│   ├── config/
│   │   └── database.php        # Database configuration
│   ├── includes/
│   │   ├── reports.php         # Report generation functions
│   │   └── xml_parser.php      # XML parsing logic
│   ├── uploads/                # Uploaded XML files
│   ├── cache/                  # API response cache
│   ├── create_admin_user.php   # Admin user creation
│   ├── unlock_admin.php        # Unlock locked admin account
│   ├── migrate_customer_support.php  # Database migration
│   └── start_server.php        # Backend server starter
├── frontend/
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── components/         # Reusable React components
│   │   ├── pages/              # Page components
│   │   │   ├── Dashboard.js
│   │   │   ├── ManualEntry.js
│   │   │   ├── DailySummary.js
│   │   │   ├── FileUpload.js
│   │   │   └── ...
│   │   ├── services/           # API service layer
│   │   ├── hooks/              # Custom React hooks
│   │   └── App.js              # Main app component
│   ├── package.json
│   └── server.js               # Development server
├── database_schema.sql         # Complete database schema
├── start_all.bat               # Windows: Start both servers
└── README.md                   # This file
```

## 🔧 Maintenance & Utilities

### Unlock Admin Account

If admin account is locked after failed login attempts:

```
http://localhost:8001/unlock_admin.php
```

### Database Migration

If upgrading from an older version without customer support:

```bash
php backend/migrate_customer_support.php
```

This adds:
- `customer` column to shipments
- `style`, `color`, `order_qty` columns
- `entry_type` column (xml/manual)

### Clear Cache

Delete files in `backend/cache/` to clear API cache.

## 📊 Database Schema

### Tables

1. **shipments** - Stores PO/shipment information
   - `id`, `internal_po_number`, `customer`, `file_name`
   - `import_date`, `style`, `color`, `order_qty`
   - `entry_type` (xml/manual)

2. **cartons** - Individual carton tracking
   - `id`, `shipment_id`, `barcode_2d`, `po_number`
   - `size`, `units`, `status`, `scan_timestamp`
   - `qc_number`, `finishing_number`
   - `truck_shipment_id` - Links carton to truck for exit tracking

3. **truck_shipments** - Truck dispatch tracking
   - `id`, `shipment_date`, `shipment_week`
   - `truck_reg`, `driver_name`
   - Links to cartons via `truck_shipment_id`

4. **users** - Authentication
   - `id`, `username`, `password`, `role`
   - `failed_login_attempts`, `locked_until`

## 🔐 Security

- Passwords are hashed using PHP's `password_hash()`
- Account lockout after 5 failed login attempts
- SQL injection protection via prepared statements
- CORS headers configured for API security
- Input validation on all forms

## 🐛 Troubleshooting

### Backend won't start
- Check if port 8001 is available
- Verify PHP is installed: `php -v`
- Check MySQL is running in XAMPP

### Frontend won't start
- Run `npm install` in frontend directory
- Check if port 3000 is available
- Clear node_modules and reinstall if needed

### Database connection error
- Verify MySQL is running
- Check credentials in `backend/config/database.php`
- Ensure database `warehouse_tracking` exists

### Cannot login
- Verify admin user was created
- Try unlocking account: `http://localhost:8001/unlock_admin.php`
- Check browser console for errors

### XML import fails
- Verify XML file format matches expected structure
- Check `backend/uploads/` folder permissions
- Review PHP error logs

## 📝 API Endpoints

### Shipments
- `GET /api/shipments.php` - List all shipments
- `GET /api/shipments.php?id={id}` - Get shipment details
- `GET /api/shipments.php?id={id}&export=csv` - Export to CSV
- `GET /api/shipments.php?id={id}&export=pdf` - Export to PDF

### Manual Entry
- `POST /api/manual_entry.php` - Create manual shipment

### Daily Summary
- `GET /api/daily_summary.php?date={YYYY-MM-DD}` - Get daily summary

### Authentication
- `POST /api/login.php` - User login
- `POST /api/logout.php` - User logout

## 🎯 Workflow Example

### Scenario: Receiving OTB Shipment

1. **Create Shipment** (Manual Entry)
   - Customer: OTB
   - PO: 855
   - Style: workwear
   - Color: royal
   - Order Qty: 1500
   - Cartons Expected: 131
   - Units Expected: 1500
   - Cartons Received: 131 (if all received today)

2. **System Creates**
   - Shipment record with internal PO: OTB-855
   - 131 carton records with status "entered"
   - Barcodes: OTB-855-0001 through OTB-855-0131

3. **View in Daily Summary**
   - Shows OTB-855 with 131 cartons entered today
   - Export report for management

4. **Track Shipment**
   - View shipment details
   - See all 131 cartons
   - Export carton list

## 📞 Support

For issues or questions:
1. Check this README
2. Check browser console and PHP error logs
3. Verify all services are running

## 📄 License

Proprietary - FTM Garments

## 🔄 Version History

### v2.1 (Current)
- **Streamlined Exit Workflow**
  - Quick truck creation during exit scanning
  - Driver information capture (name, truck reg, FTM pin, date, week)
  - Automatic carton-to-truck linking
  - Active truck banner with visual feedback
  - Complete audit trail for dispatch
- Removed standalone truck shipment page (integrated into scanner)
- Enhanced scanner workflow for better user experience

### v2.0
- Added multi-customer support (OTB, OBSW)
- Manual entry functionality
- Enhanced daily summary with expected/entered/pending breakdown
- Improved export formats
- Customer-specific PO numbering

### v1.0
- Initial release
- XML import
- Basic carton tracking
- Dashboard and reports

---

**FTM Garments Warehouse Tracking System** - Streamlining warehouse operations since 2026

# System Fixes Implemented

## Overview
This document outlines the new features implemented based on the SYS. FIX2 requirements.

## 1.1 Shipment Summary per Truck ✅

### Features Implemented:
- **Truck Shipment Management** - Allocate orders to specific trucks for dispatch
- **Shipment Details Tracking**:
  - Date and Shipment Week (e.g., Wk16)
  - Truck Registration Number
  - Driver Name
  - Remarks field for notes (e.g., "shipment incomplete, short of 1 box due to less cut of PO")
- **Order Assignment** - Add multiple POs to a single truck shipment
- **Summary Report** - Shows:
  - PO Number
  - Customer
  - Order Quantity
  - Units Shipped
  - Total Cartons
  - Cartons Shipped
- **Export Options** - CSV and PDF export with all shipment details

### Files Created:
- `backend/api/truck_shipment.php` - API for CRUD operations
- `backend/api/truck_shipment_export.php` - Export functionality
- `frontend/src/pages/TruckShipment.js` - Frontend interface
- `backend/migrate_truck_shipments.php` - Database migration

### Database Tables Added:
```sql
truck_shipments (
  id, shipment_date, shipment_week, truck_reg, 
  driver_name, remarks, created_at, updated_at
)

truck_shipment_items (
  id, truck_shipment_id, shipment_id, 
  cartons_shipped, units_shipped, created_at
)
```

### How to Use:
1. Navigate to "Truck Shipment" in the sidebar
2. Click "New Shipment"
3. Fill in truck details (date, week, registration, driver)
4. Add orders from the dropdown
5. Specify cartons and units shipped for each order
6. Add remarks if needed
7. Click "Create Shipment"
8. Export to CSV or PDF for documentation

---

## 1.2 Export to CSV for Purchase Orders ✅

### Status: ALREADY IMPLEMENTED
The system already exports purchase orders and reports to CSV with proper formatting (data in separate columns, not one column).

### Existing Features:
- Shipment details export (CSV/PDF)
- Daily summary export (CSV/PDF)
- Truck shipment export (CSV/PDF)
- All exports use proper column separation

---

## 1.3 Add Count Feature During Scanning ✅

### Features Implemented:
- **Scan Count Display** - Shows how many times each carton has been scanned
- **Real-time Counter** - Updates immediately after each scan
- **Scan History** - View all scans for a carton with timestamps
- **Audit Trail** - Complete log of all scanning activities

### Files Created/Updated:
- `backend/api/scan_carton_v2.php` - Enhanced scanning API with count tracking
- Database migration adds scan count functionality

### Database Changes:
```sql
scan_audit_log (
  id, carton_id, scan_type, scan_timestamp, 
  scanned_by, previous_status, new_status, notes
)
```

### How It Works:
- Each scan is logged in the audit trail
- System counts total scans per carton
- Displays scan count in scan result
- Shows "Scan #X" for each carton

---

## 1.4 Add Date/Time and Scanned By Columns ✅

### Features Implemented:
- **Scan Timestamp** - Records exact date and time of each scan
- **Scanned By** - Tracks which user performed the scan
- **Scan Type** - Differentiates between entry and exit scans
- **Audit Trail** - Complete history with all details

### Database Columns Added:
```sql
cartons table:
  - scanned_by VARCHAR(100) - User who scanned
  - scan_type ENUM('entry','exit') - Type of scan

scan_audit_log table:
  - scan_timestamp DATETIME - When scan occurred
  - scanned_by VARCHAR(100) - User who scanned
  - scan_type ENUM('entry','exit') - Entry or exit
  - previous_status - Status before scan
  - new_status - Status after scan
```

### Display Format:
- **Date and Time**: "2026-05-06 14:30:45"
- **Scanned By**: Username or "System"
- **Scan Type**: "Entry" or "Exit"

### Export Includes:
All CSV and PDF exports now include:
- Scan timestamp
- Scanned by user
- Scan type (entry/exit)

---

## Installation Instructions

### 1. Run Database Migration

```bash
php backend/migrate_truck_shipments.php
```

This will create:
- `truck_shipments` table
- `truck_shipment_items` table
- `scan_audit_log` table
- Add `scanned_by` and `scan_type` columns to `cartons` table

### 2. Update Frontend Routes

Add the TruckShipment route to your React Router configuration:

```javascript
import TruckShipment from './pages/TruckShipment';

// In your routes:
<Route path="/truck-shipment" element={<TruckShipment />} />
```

### 3. Add Sidebar Menu Item

Add to your sidebar navigation:

```javascript
<Link to="/truck-shipment">
  <i className="bi bi-truck"></i> Truck Shipment
</Link>
```

### 4. Update Scanning API (Optional)

To use the enhanced scanning with audit trail, update your scanner to use:
- `backend/api/scan_carton_v2.php` instead of the old scanning endpoint

---

## Testing Checklist

### Truck Shipment Management
- [ ] Create new truck shipment
- [ ] Add multiple orders to shipment
- [ ] Edit carton/unit quantities
- [ ] Add remarks
- [ ] Export to CSV
- [ ] Export to PDF
- [ ] View shipment list
- [ ] Verify totals are correct

### Scan Count Feature
- [ ] Scan a carton multiple times
- [ ] Verify count increments
- [ ] Check scan history
- [ ] Verify audit log entries

### Date/Time and Scanned By
- [ ] Perform entry scan
- [ ] Verify timestamp is recorded
- [ ] Verify scanned_by is recorded
- [ ] Perform exit scan
- [ ] Check scan_type is correct
- [ ] Export and verify columns appear

---

## API Endpoints

### Truck Shipment
- `GET /api/truck_shipment.php` - List all truck shipments
- `GET /api/truck_shipment.php?id={id}` - Get specific shipment
- `POST /api/truck_shipment.php` - Create new shipment
- `PUT /api/truck_shipment.php` - Update shipment
- `DELETE /api/truck_shipment.php` - Delete shipment

### Export
- `GET /api/truck_shipment_export.php?id={id}&format=csv` - Export to CSV
- `GET /api/truck_shipment_export.php?id={id}&format=pdf` - Export to PDF

### Enhanced Scanning
- `POST /api/scan_carton_v2.php` - Scan with audit trail

---

## Benefits

1. **Better Dispatch Management** - Track which orders go on which trucks
2. **Complete Audit Trail** - Know who scanned what and when
3. **Improved Accountability** - User tracking for all scans
4. **Better Reporting** - Detailed shipment summaries with remarks
5. **Scan Verification** - Count feature helps identify duplicate scans
6. **Historical Data** - Complete scan history for troubleshooting

---

## Future Enhancements

Potential improvements for future versions:
- Barcode printing for truck shipment labels
- Driver signature capture
- Photo upload for shipment verification
- Real-time truck tracking integration
- SMS notifications to drivers
- Mobile app for drivers to confirm receipt

---

## Support

For issues or questions:
1. Check database migration ran successfully
2. Verify all API endpoints are accessible
3. Check browser console for errors
4. Review PHP error logs
5. Ensure all tables were created correctly

---

**Implementation Date**: May 2026  
**Version**: 2.1  
**Status**: ✅ Complete


---

## 1.5 Fix Manual Entry - Change "OTB" to "Otto" ✅

### Issue Fixed:
- Changed customer name from "OTB" to "Otto" in manual entry form
- Updated default customer selection
- Fixed display text in instructions

### Files Updated:
- `frontend/src/pages/ManualEntry.js` - Changed customer dropdown

### Changes Made:
```javascript
// Before: const customers = ['MRP', 'OTB', 'OBSW', 'Other'];
// After:  const customers = ['MRP', 'Otto', 'OBSW', 'Other'];

// Before: customer: 'OTB'
// After:  customer: 'Otto'
```

### Update Functionality Added:
- Added PUT method support to manual_entry.php API
- Can now update existing manual entries
- Can add more cartons to existing shipments
- Can update style, color, and order quantity

### API Endpoints:
- `POST /api/manual_entry.php` - Create new manual entry
- `PUT /api/manual_entry.php` - Update existing manual entry

### Update Request Format:
```json
{
  "shipment_id": 18,
  "style": "updated style",
  "color": "updated color",
  "order_qty": 2000,
  "add_cartons": 10,
  "units_per_carton": 15,
  "mark_as_received": true
}
```

---

## 1.6 Restrict Delete Functions with Password Protection ✅

### Features Implemented:
- **Admin Delete Code** - Special code required for all deletions
- **Password Protection** - Prevents accidental deletions
- **Audit Logging** - All deletions are logged with timestamp
- **Multiple Delete Types** - Supports shipments, cartons, truck shipments, users

### Files Created:
- `backend/api/admin_delete.php` - Protected delete API

### Admin Delete Code:
```
FTM2026DELETE
```
⚠️ **Change this code in the file for security!**

### How to Use:
1. When deleting any data, system prompts for admin code
2. Enter the special admin code
3. Deletion is logged and executed
4. Cannot delete admin users

### Delete Types Supported:
- `shipment` - Delete entire shipment (cascades to cartons)
- `carton` - Delete single carton
- `truck_shipment` - Delete truck shipment
- `user` - Delete user (except admin)

### API Request Format:
```json
{
  "admin_code": "FTM2026DELETE",
  "delete_type": "shipment",
  "id": 123
}
```

### Security Features:
- Code verification before deletion
- Prevents admin user deletion
- Logs all deletions to error log
- Transaction rollback on failure

---

## 1.7 Code-Based Login for Warehouse Employees ✅

### Features Implemented:
- **Employee Code Login** - Simple code-based authentication
- **Name Display Only** - Shows only employee name in "Scanned by" column
- **Session Management** - 8-hour session tokens
- **Role-Based Access** - Scanner, Supervisor, Admin roles

### Files Created:
- `backend/api/employee_login.php` - Employee login API
- `backend/migrate_employees.php` - Database migration
- `frontend/src/pages/EmployeeLogin.js` - Login interface

### Database Tables Added:
```sql
employees (
  id, employee_code, employee_name, role, 
  is_active, last_login, created_at, updated_at
)

employee_sessions (
  id, employee_id, token, expires_at, created_at
)
```

### Sample Employee Codes:
- **EMP001** - Mkhaya (Scanner)
- **EMP002** - Thabo (Scanner)
- **EMP003** - Sipho (Scanner)
- **ADMIN01** - Admin User (Admin)

### How It Works:
1. Employee enters their code (e.g., EMP001)
2. System validates code and creates session
3. Employee name is stored in session
4. When scanning, only name appears in "Scanned by" column
5. Session expires after 8 hours

### Roles:
- **Scanner** - Can scan cartons only
- **Supervisor** - Can scan and view reports
- **Admin** - Full access including deletions

### Integration with Scanning:
Update your scanner to use employee name:
```javascript
const employeeName = localStorage.getItem('employee_name');

// When scanning:
{
  barcode: '...',
  action: 'entry',
  scanned_by: employeeName  // Shows "Mkhaya" not "EMP001"
}
```

### Adding New Employees:
```sql
INSERT INTO employees (employee_code, employee_name, role) 
VALUES ('EMP004', 'New Employee Name', 'scanner');
```

---

## Installation Instructions for New Features

### 1. Run Employee Migration

```bash
php backend/migrate_employees.php
```

### 2. Update Admin Delete Code

Edit `backend/api/admin_delete.php` and change:
```php
define('ADMIN_DELETE_CODE', 'YOUR_SECRET_CODE_HERE');
```

### 3. Add Employee Login Route

In your React Router:
```javascript
import EmployeeLogin from './pages/EmployeeLogin';

<Route path="/employee-login" element={<EmployeeLogin />} />
```

### 4. Update Scanner to Use Employee Name

In your scanner component:
```javascript
const employeeName = localStorage.getItem('employee_name') || 'System';

// Use employeeName when calling scan API
```

---

## Testing Checklist for New Features

### Manual Entry Update
- [ ] Create manual entry with "Otto" customer
- [ ] Verify "Otto" appears in dropdown
- [ ] Update existing manual entry
- [ ] Add more cartons to existing entry
- [ ] Verify updates are saved

### Delete Protection
- [ ] Try to delete shipment without code
- [ ] Enter wrong admin code
- [ ] Enter correct admin code
- [ ] Verify deletion works
- [ ] Check error log for deletion record
- [ ] Try to delete admin user (should fail)

### Employee Login
- [ ] Login with EMP001
- [ ] Verify session is created
- [ ] Scan a carton
- [ ] Check "Scanned by" shows "Mkhaya" not "EMP001"
- [ ] Wait 8 hours and verify session expires
- [ ] Try invalid employee code
- [ ] Deactivate employee and try login

---

## Security Notes

1. **Admin Delete Code**: Change the default code immediately after installation
2. **Employee Codes**: Use strong, unique codes for each employee
3. **Session Tokens**: Tokens expire after 8 hours for security
4. **Audit Trail**: All deletions and logins are logged
5. **Role-Based Access**: Implement proper role checks in frontend

---

**Updated**: May 2026  
**Version**: 2.2  
**Status**: ✅ All Features Complete

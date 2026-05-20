# Driver Information Workflow - Implementation Guide

## Overview
This document outlines the streamlined workflow for capturing driver information before scanning cartons out for dispatch.

---

## 🚛 Current Exit Workflow (IMPLEMENTED)

### 1. Click "Exit Warehouse" Button
- Opens a modal (no more manual truck selection)
- Forces user to enter:
  - **Truck Registration** (e.g., ABC 123 GP)
  - **Driver First Name**
  - **Driver Surname**
  - **Employee Pin** (e.g., 12901)
  - **Shipment Date** (defaults to today)
  - **Week** (e.g., Wk16)

### 2. System Creates Truck & Returns to Scanner
- Combines name + surname for full driver name
- Creates truck shipment in background
- **Closes modal and returns to normal scanner page**
- Shows active truck banner at top with truck info
- Automatically sets action to "Exit"
- Stores truck info in localStorage

### 3. Normal Scanning Workflow
- Use the regular scanner interface (manual entry or camera)
- Enter PO number as usual
- Scan cartons one by one
- **System automatically**:
  - Links each carton to the active truck via `truck_shipment_id`
  - Tracks which PO each carton belongs to
  - Shows success messages after each scan
  - Adds notes: "Loaded to [Truck Reg]"

### 4. Active Truck Banner
- Displays at top: "Loading to: [Truck Reg]" with driver name
- Shows "Finish Loading" button to complete the truck
- Prevents switching to "Enter" mode while truck is active
- Action buttons are disabled until loading is finished

### 5. Complete Loading
- Click "Finish Loading" when done
- Confirms completion
- Clears active truck from localStorage
- Returns to normal scanning mode

---

## ✅ Key Benefits

1. **Familiar Interface** - Uses the same scanner you're used to
2. **No Modal Scanning** - After driver info, you're back to the normal page
3. **Visual Feedback** - Clear banner shows which truck you're loading
4. **Automatic Linking** - Every scan is automatically linked to the truck
5. **Complete Audit Trail** - Every carton linked to specific truck/driver
6. **Driver Verification** - Employee Pin ensures authorized personnel
7. **Persistent State** - Truck info survives page refreshes via localStorage

---

## 🧪 Testing Instructions

1. Go to `/scanner`
2. Click **"Exit Warehouse"** button
3. Enter:
   - Truck Reg: `ABC123`
   - Driver First Name: `Mkhaya`
   - Driver Surname: `Sithole`
   - Employee Pin: `12901`
   - Shipment Date: (defaults to today)
   - Week: `Wk16` (or current week)
4. Click **"Start Scanning"**
5. **Modal closes** - you're back on the scanner page
6. See the green banner showing your active truck
7. Enter PO number and scan cartons normally
8. Each scan is automatically linked to the truck
9. Click **"Finish Loading"** when done

---

## Database Schema (Already Implemented)

### cartons table
```sql
ALTER TABLE cartons 
ADD COLUMN truck_shipment_id INT(11) DEFAULT NULL COMMENT 'Link to truck shipment' AFTER scan_type,
ADD KEY idx_truck_shipment_id (truck_shipment_id),
ADD CONSTRAINT cartons_truck_fk 
  FOREIGN KEY (truck_shipment_id) 
  REFERENCES truck_shipments(id) 
  ON DELETE SET NULL;
```

### scan_audit_log table
```sql
ALTER TABLE scan_audit_log 
ADD COLUMN truck_shipment_id INT(11) DEFAULT NULL COMMENT 'Truck shipment for exit scans' AFTER scanned_by,
ADD KEY idx_truck_audit (truck_shipment_id);
```

---

## Backend API (Already Implemented)

### quick_truck.php
Creates a new truck shipment with minimal information:
- `truck_reg`: Truck registration number
- `driver_name`: Full driver name (combined from first + last)
- Returns truck object with `id`, `truck_reg`, `driver_name`

### scan.php
Updated to accept `truck_shipment_id` parameter:
- When action is 'exit' and `truck_shipment_id` is provided
- Links the carton to the truck shipment
- Adds notes about which truck it was loaded to

---

## Frontend Implementation (Already Implemented)

### ExitScanModal Component
Located: `frontend/src/components/ExitScanModal.js`

**Features:**
- Single-step driver information form
- Creates truck via `quick_truck.php` API
- Stores truck info in localStorage as `active_truck`
- Calls `onSuccess` callback with truck data
- Closes modal after successful creation

### CartonScanner Component
Located: `frontend/src/pages/CartonScanner.js`

**Features:**
- Checks localStorage for `active_truck` on mount
- Displays active truck banner when truck is active
- Automatically sets action to 'exit' when truck is active
- Disables action toggle buttons while truck is active
- Includes `truck_shipment_id` in scan requests
- "Finish Loading" button clears active truck

**State Management:**
```javascript
const [activeTruck, setActiveTruck] = useState(null);

// On mount
useEffect(() => {
  const storedTruck = localStorage.getItem('active_truck');
  if (storedTruck) {
    const truck = JSON.parse(storedTruck);
    setActiveTruck(truck);
    setAction('exit');
  }
}, []);

// In scan function
if (activeTruck && actionToUse === 'exit') {
  requestData.truck_shipment_id = activeTruck.id;
  requestData.notes = `Loaded to ${activeTruck.truck_reg}`;
}
```

---

## User Workflow

### Step-by-Step Process

1. **Start Exit Scanning**
   - Click "Exit Warehouse" button
   - Enter driver and truck information
   - System creates truck shipment

2. **Scan Cartons**
   - Modal closes, back to normal scanner
   - See active truck banner at top
   - Enter PO number as usual
   - Scan cartons one by one
   - Each scan automatically links to truck

3. **Complete Loading**
   - Click "Finish Loading" button
   - Confirm completion
   - System clears active truck
   - Ready for next operation

4. **Reports**
   - View which cartons went on which truck
   - Driver accountability via truck_shipments table
   - Complete audit trail in scan_audit_log

---

## Benefits of This Approach

1. ✅ **Complete Traceability** - Know exactly which driver took which cartons
2. ✅ **Prevents Errors** - Clear visual indicator of active truck
3. ✅ **Better Accountability** - Driver responsible for specific cartons
4. ✅ **Accurate Reports** - Dispatch summaries per truck/driver
5. ✅ **Audit Trail** - Complete history in scan_audit_log
6. ✅ **Familiar Interface** - Uses existing scanner workflow
7. ✅ **Persistent State** - Survives page refreshes
8. ✅ **Simple** - One modal, then normal scanning

---

## Migration Script

Run this to add the required database columns:

```bash
php backend/migrate_driver_workflow.php
```

---

**Status**: ✅ FULLY IMPLEMENTED

The system now provides a streamlined exit workflow that captures driver information upfront, then allows normal scanning with automatic truck linking.

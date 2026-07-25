# Legacy Warehouse Goods - Complete Workflow Guide

## Overview

Legacy Warehouse Goods represents **stock from previous years still inside the warehouse**. This system tracks old inventory that hasn't been shipped yet.

---

## 1. How Legacy Orders Are Counted in Dashboard

### Dashboard Cards Show:

**Location**: Dashboard → "Legacy Warehouse" card

**Metrics Displayed:**
- **Orders Count**: Total number of ALL legacy POs (any status)
- **Cartons**: Sum of all cartons_count (all orders)
- **Units**: Sum of all quantity_inside (all orders)

### How It's Calculated:

**Backend**: `backend/api/dashboard_stats.php`

```php
SELECT 
    COUNT(*) as orders_count,
    COALESCE(SUM(cartons_count), 0) as total_cartons,
    COALESCE(SUM(quantity_inside), 0) as total_units
FROM legacy_warehouse_goods
-- NO STATUS FILTER - counts ALL orders regardless of status
```

**Included in Dashboard Totals:**
- ✅ **Factory Units** card = Current year units + ALL Legacy units (active, shipped, cancelled, etc.)
- ✅ **Total Units** card = All units including all legacy statuses

**Why Count All Statuses?**
- Provides complete picture of legacy inventory
- Even "shipped" items may still be tracked for historical data
- "Cancelled" orders still represent physical stock that was in warehouse
- Better audit trail and reporting

---

## 2. Legacy Warehouse Management

### Access:
**Navigation**: Sidebar → "Legacy Warehouse Stock"

### Features:

#### A. **Add New Legacy Order**
- Click "Add Order" button
- Fill in form:
  - FTM PO (auto-prefixes with FTM-)
  - Customer Order Number
  - Customer (MRP/OTB/OBSW/Other)
  - Style, Color
  - Order Quantity
  - Quantity Inside (current stock)
  - Cartons Label & Count
  - Status
  - Remarks
  - New Developments
  - Source Year (default: 2025)
- System creates manual entry in `legacy_warehouse_goods` table

#### B. **Edit Existing Order**
- Click "Edit" icon on any row
- Update any fields
- Status can be changed

#### C. **Delete Order**
- Click "Delete" icon
- **Admin authentication required**
- Only legacy orders can be deleted
- System orders redirect to PO Details page

#### D. **Quick Status Change**
- Dropdown in "Status" column
- Changes status without opening edit modal
- Options:
  - ⚪ Active
  - 🟢 Shipped
  - 🔴 Cancelled
  - 🟡 Not Audited
  - 🔵 Failed Audit
  - 🟠 Waiting for Booking

---

## 3. How To Exit Legacy Warehouse (Ship Out)

### Current Workflow:

**Method 1: Change Status to "Shipped"**
1. Go to Legacy Warehouse Stock page
2. Find the order to ship
3. Change status dropdown → "Shipped"
4. Order moves to "Shipped" filter
5. **No longer counted in dashboard "Factory Units"**

**Method 2: Record Shipped Quantity**
1. Edit the order
2. Update `shipped_qty` field
3. System tracks: `quantity_inside` - `shipped_qty` = remaining in warehouse
4. If fully shipped → change status to "Shipped"

---

### **Truck Loading Integration (MISSING FEATURE)**

**Current Issue**: ❌ Legacy orders **cannot** be added to truck shipments via scanner

**What's Missing:**
1. When scanning cartons for exit, system only handles:
   - Current year cartons (linked to shipments table)
   - Cannot scan legacy warehouse cartons (no barcode system)

2. Truck shipment page shows:
   - Current year cartons shipped
   - **Separate** legacy items (but added manually)

**Solution Needed:**
- Legacy orders need to be manually added to truck shipments
- OR status manually changed to "Shipped" when loaded

---

## 4. Database Schema

### Table: `legacy_warehouse_goods`

```sql
CREATE TABLE IF NOT EXISTS legacy_warehouse_goods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    internal_po VARCHAR(50) NOT NULL,          -- FTM PO
    customer_order_number VARCHAR(50),         -- Customer order #
    customer VARCHAR(50) DEFAULT 'MRP',        -- MRP/OTB/OBSW/Other
    customer_other VARCHAR(100),               -- Custom customer name
    style VARCHAR(200),                        -- Product style
    color VARCHAR(100),                        -- Product color
    order_qty INT,                             -- Total order quantity
    quantity_inside INT,                       -- Current stock in warehouse
    cartons_label VARCHAR(50),                 -- Carton description
    cartons_count INT,                         -- Number of cartons
    status VARCHAR(50) DEFAULT 'active',       -- Status (active/shipped/cancelled/etc.)
    remarks TEXT,                              -- Additional notes
    new_developments TEXT,                     -- Latest updates
    shipped_qty INT DEFAULT 0,                 -- Quantity already shipped
    source_year SMALLINT DEFAULT 2025,         -- Year of origin
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 5. Status Options

| Status | Badge Color | Meaning | Counts in Dashboard? |
|--------|-------------|---------|---------------------|
| **Active** | Secondary (Gray) | Currently in warehouse | ✅ Yes |
| **Shipped** | Success (Green) | Already shipped out | ✅ Yes (ALL statuses counted) |
| **Cancelled** | Danger (Red) | Order cancelled | ✅ Yes (ALL statuses counted) |
| **Not Audited** | Warning (Yellow) | Needs audit | ✅ Yes |
| **Failed Audit** | Dark | Failed quality check | ✅ Yes |
| **Waiting for Booking** | Info (Blue) | Awaiting transport | ✅ Yes |

**Note**: Dashboard counts ALL legacy orders regardless of status for complete historical tracking.

---

## 6. Filters Available

**Status Filter:**
- All
- Active
- Shipped
- Cancelled
- Not Audited
- Failed Audit
- Waiting for Booking

**Customer Filter:**
- All Customers
- MRP
- OTB
- OBSW
- Other

**Source Year Filter:**
- All Years
- 2024
- 2025
- etc.

**In Warehouse Only:**
- Checkbox: Shows only items with `quantity_inside > 0`

**Search:**
- Search by FTM PO, Customer Order, Style, Color

---

## 7. Truck Shipment Integration

### Current State:

**Truck shipments track legacy items separately:**

#### Table: `truck_shipment_legacy_items`
```sql
CREATE TABLE IF NOT EXISTS truck_shipment_legacy_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    truck_shipment_id INT NOT NULL,      -- Links to truck_shipments
    legacy_goods_id INT NOT NULL,        -- Links to legacy_warehouse_goods
    cartons_shipped INT NOT NULL,
    units_shipped INT NOT NULL,
    FOREIGN KEY (truck_shipment_id) REFERENCES truck_shipments(id) ON DELETE CASCADE,
    FOREIGN KEY (legacy_goods_id) REFERENCES legacy_warehouse_goods(id) ON DELETE CASCADE
);
```

**How Legacy Items Are Added to Trucks:**
1. Navigate to Truck Shipment page
2. Select truck
3. **Manually add legacy items** (not via scanner)
4. System links: `truck_shipment_legacy_items` → `legacy_warehouse_goods`

---

## 8. Export Capabilities

**CSV Export:** ✅ Available
- Button: "Export CSV"
- Exports current filtered list
- Includes all fields

**PDF Export:** ❌ Not currently implemented for this page

---

## 9. API Endpoints

### Get Legacy Warehouse List
```
GET /warehouse_stock_list.php
Query Parameters:
- status: active|shipped|cancelled|not_audited|failed_audit|waiting_for_booking
- customer: MRP|OTB|OBSW|Other
- source_year: 2024|2025
- in_warehouse_only: 1 (shows only items with quantity_inside > 0)
- search: text search
```

### Create Legacy Order
```
POST /legacy_warehouse_goods.php
Body: {
    internal_po, customer_order_number, customer, style, color,
    order_qty, quantity_inside, cartons_label, cartons_count,
    status, remarks, new_developments, shipped_qty, source_year
}
```

### Update Legacy Order
```
PUT /legacy_warehouse_goods.php
Body: { id, ...all fields... }
```

### Delete Legacy Order
```
DELETE /legacy_warehouse_goods.php?id=X&admin_code=Y
Requires: Admin authentication
```

### Update Status (for system orders)
```
POST /update_shipment_warehouse_status.php
Body: { shipment_id, warehouse_order_status }
```

---

## 10. Common Workflows

### Workflow 1: Add Old Stock to System
1. Go to Legacy Warehouse Stock
2. Click "Add Order"
3. Enter FTM PO (e.g., 15730)
4. Fill in details: style, color, quantities
5. Set status = "Active"
6. Enter cartons count
7. Save

### Workflow 2: Ship Out Legacy Stock
1. Find order in list (filter: Active)
2. **Option A**: Change status to "Shipped" via dropdown
3. **Option B**: Edit order, update `shipped_qty`, save
4. Order no longer counts in "Factory Units"

### Workflow 3: Load Legacy Stock on Truck
1. Go to Truck Shipment page
2. Create/select truck
3. Manually add legacy items (specify cartons, units)
4. System creates entry in `truck_shipment_legacy_items`
5. Legacy order `quantity_inside` should be manually updated

### Workflow 4: Track Partial Shipment
1. Edit legacy order
2. Update `shipped_qty` to reflect partial shipment
3. Keep status = "Active" if more remains
4. Change to "Shipped" when fully depleted

---

## 11. Known Limitations

### ❌ Cannot Scan Legacy Cartons for Exit
- Legacy items don't have barcodes in system
- Must manually track exits

### ❌ No Automatic Quantity Reduction
- When loaded on truck, `quantity_inside` doesn't auto-decrement
- Must manually update

### ⚠️ Manual Process Required
- Adding to trucks is manual (not via scanner)
- Status changes are manual

---

## 12. Recommended Improvements

### Priority 1: Auto-Update Quantities
When legacy item added to truck:
- Auto-reduce `quantity_inside`
- Auto-set `shipped_qty`
- Auto-change status to "Shipped" when fully depleted

### Priority 2: Barcode Generation
- Generate barcodes for legacy cartons
- Enable scanner integration
- Unified exit workflow

### Priority 3: Truck Loading Enhancement
- Better UI for adding legacy items to trucks
- Bulk selection
- Quick-add from legacy warehouse page

---

## Summary

**Legacy Warehouse System:**
- ✅ Tracks old stock still in warehouse
- ✅ Counts in dashboard metrics
- ✅ Full CRUD operations
- ✅ Status management
- ✅ Export to CSV
- ⚠️ Manual exit tracking (no scanner integration)
- ⚠️ Requires manual quantity updates

**To ship legacy stock:** Change status to "Shipped" or manually update shipped quantities.

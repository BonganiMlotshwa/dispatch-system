# Testing Guide - Quick Start

## ✅ Setup Complete!

All migrations have run successfully. You can now start testing!

---

## 🧪 Testing Order (Recommended)

### 1. Test Employee Login (5 minutes)
**URL**: `http://localhost:3000/employee-login`

**Test Cases**:
- [ ] Login with `EMP001` (Mkhaya)
- [ ] Verify you're redirected to scanner
- [ ] Check localStorage has `employee_name` = "Mkhaya"
- [ ] Try invalid code (should fail)

**Sample Codes**:
- `EMP001` - Mkhaya
- `EMP002` - Thabo
- `EMP003` - Sipho
- `ADMIN01` - Admin User

---

### 2. Test Manual Entry with "Otto" (5 minutes)
**URL**: `http://localhost:3000/manual-entry`

**Test Cases**:
- [ ] Verify dropdown shows "Otto" (not "OTB")
- [ ] Create entry: Customer=Otto, PO=845, Style=workwear, Color=royal
- [ ] Set: Order Qty=1500, Cartons Expected=67, Units Expected=1005
- [ ] Set: Cartons Received=60 (7 pending)
- [ ] Click "Create Entry"
- [ ] Verify success message
- [ ] Check it appears in Purchase Orders

---

### 3. Test Truck Shipment (10 minutes)
**URL**: `http://localhost:3000/truck-shipment`

**Test Cases**:
- [ ] Click "New Shipment"
- [ ] Enter: Date=Today, Truck Reg=ABC123, Driver=Mkhaya
- [ ] Add an order from dropdown
- [ ] Set cartons/units to ship
- [ ] Add remarks: "Test shipment"
- [ ] Click "Create Shipment"
- [ ] Verify it appears in list
- [ ] Click "Export CSV" - check file downloads
- [ ] Click "Export PDF" - check opens in new tab

---

### 4. Test Scanner with Driver Selection (15 minutes)
**URL**: `http://localhost:3000/scanner`

**Prerequisites**: 
- Have a truck shipment created (from step 3)
- Have some cartons in warehouse (status='entered')

**Test Entry Scan**:
- [ ] Select Action: "Entry"
- [ ] Scan a barcode (or type manually)
- [ ] Verify carton status changes to 'entered'
- [ ] Check "Scanned by" shows employee name

**Test Exit Scan**:
- [ ] Select Action: "Exit"
- [ ] Verify truck selector appears
- [ ] Select truck (ABC123 - Mkhaya)
- [ ] Scan a carton
- [ ] Verify success message shows truck info
- [ ] Check carton status changes to 'exited'
- [ ] Verify carton is linked to truck

**Test Without Truck**:
- [ ] Select Action: "Exit"
- [ ] Don't select a truck
- [ ] Try to scan
- [ ] Should show error: "Please select a truck"

---

### 5. Test Daily Summary (5 minutes)
**URL**: `http://localhost:3000/daily-summary`

**Test Cases**:
- [ ] Select today's date
- [ ] Verify shows Otto-845 with:
  - Expected: 67 cartons, 1005 units
  - Entered Today: 60 cartons, 900 units
  - Pending: 7 cartons, 105 units
- [ ] Export to CSV
- [ ] Export to PDF
- [ ] Verify all columns present

---

### 6. Test Reports with Customer Filter (10 minutes)
**URL**: `http://localhost:3000/reports`

**Test Cases**:
- [ ] Generate Comprehensive Report (All customers)
- [ ] Verify "Orders Entered" count is correct (not 1)
- [ ] Add customer filter dropdown (if not present)
- [ ] Filter by "Otto" only
- [ ] Verify shows only Otto data
- [ ] Filter by "MRP" only
- [ ] Export filtered report to CSV
- [ ] Check Inventory Report shows pending cartons

---

### 7. Test Delete Protection (5 minutes)

**Test Cases**:
- [ ] Try to delete a shipment
- [ ] System prompts for admin code
- [ ] Enter wrong code - should fail
- [ ] Enter correct code: `FTM2026DELETE`
- [ ] Deletion should succeed
- [ ] Check error log for deletion record

**⚠️ Change Admin Code First!**
Edit `backend/api/admin_delete.php` line 15 to your secret code.

---

### 8. Test Scan Audit Trail (5 minutes)

**Test Cases**:
- [ ] Scan a carton (entry or exit)
- [ ] Check database: `SELECT * FROM scan_audit_log ORDER BY id DESC LIMIT 10`
- [ ] Verify record shows:
  - scan_type (entry/exit)
  - scan_timestamp
  - scanned_by (employee name)
  - truck_shipment_id (for exit scans)
  - previous_status and new_status

---

## 🔍 Quick Database Checks

### Check Cartons Linked to Trucks
```sql
SELECT 
    c.barcode_2d,
    c.status,
    c.scanned_by,
    ts.truck_reg,
    ts.driver_name
FROM cartons c
LEFT JOIN truck_shipments ts ON c.truck_shipment_id = ts.id
WHERE c.status = 'exited'
ORDER BY c.scan_timestamp DESC
LIMIT 10;
```

### Check Scan Audit Log
```sql
SELECT 
    sal.*,
    c.barcode_2d,
    ts.truck_reg
FROM scan_audit_log sal
JOIN cartons c ON sal.carton_id = c.id
LEFT JOIN truck_shipments ts ON sal.truck_shipment_id = ts.id
ORDER BY sal.scan_timestamp DESC
LIMIT 20;
```

### Check Employee Sessions
```sql
SELECT 
    e.employee_name,
    e.employee_code,
    es.token,
    es.expires_at
FROM employee_sessions es
JOIN employees e ON es.employee_id = e.id
WHERE es.expires_at > NOW();
```

---

## 🐛 Common Issues & Solutions

### Issue: "Truck shipment must be selected"
**Solution**: Create a truck shipment first before exit scanning

### Issue: Employee login not working
**Solution**: 
- Check employee exists: `SELECT * FROM employees WHERE employee_code = 'EMP001'`
- Verify code is uppercase
- Check browser console for errors

### Issue: Reports showing wrong data
**Solution**:
- Clear browser cache
- Check date filters
- Verify customer filter is applied

### Issue: Exports not working
**Solution**:
- Check PHP error logs
- Verify API endpoint is accessible
- Test API directly: `http://localhost:8001/api/truck_shipment_export.php?id=1&format=csv`

### Issue: Pending cartons not showing
**Solution**: Already fixed! The report now correctly shows pending cartons.

---

## 📊 Expected Results

After testing, you should have:
- ✅ Employee login working
- ✅ Manual entries with "Otto" customer
- ✅ Truck shipments created
- ✅ Cartons scanned with driver tracking
- ✅ Complete audit trail
- ✅ Reports showing correct data
- ✅ All exports working (CSV & PDF)

---

## 🎯 Production Checklist

Before going live:
- [ ] Change admin delete code
- [ ] Create real employee codes
- [ ] Test with real data
- [ ] Train warehouse staff
- [ ] Print employee code cards
- [ ] Test on actual devices (tablets/phones)
- [ ] Backup database
- [ ] Document workflows

---

## 📞 Need Help?

Check these files:
- `IMPLEMENTATION_CHECKLIST.md` - Complete feature list
- `DRIVER_WORKFLOW_IMPLEMENTATION.md` - Driver workflow details
- `SYSTEM_FIXES_IMPLEMENTED.md` - All fixes and features
- `README.md` - General system documentation

---

**Happy Testing! 🚀**

Everything is ready to go. Start with Employee Login and work your way through the list.

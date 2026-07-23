# Schedule Linking Problem - Analysis & Solutions

## Problem Summary

**Issue**: Uploaded .mrpg files show as "unlinked" when they should automatically match to schedules.

**Root Cause**: The system matches files to schedules by comparing:
- **Customer Order Number** (from .mrpg file) 
- vs **Order No** (from weekly Excel schedule)

When these numbers don't match, the file cannot be linked automatically.

---

## How the Current System Works

### 1. File Upload Flow
```
User uploads .mrpg file
    ↓
System extracts customer_order_no from XML
    ↓
Searches delivery_schedule_orders table for matching order_no
    ↓
IF FOUND: Auto-fill FTM indent, style, color → "linked"
IF NOT FOUND: Mark as "unlinked" → requires manual entry
```

### 2. Matching Logic
File: `backend/includes/schedule_lookup.php` → `scheduleLookupOrderInLibrary()`

```php
// Searches for exact match:
SELECT order_no FROM delivery_schedule_orders WHERE order_no = ?
```

**Match criteria**: EXACT string match (case-insensitive)
- File has: `1293599`
- Schedule has: `1212657`
- Result: NO MATCH → unlinked

---

## Diagnostic Results (From Previous Session)

**Schedule Library Contains:**
- Orders: 1212657, 1249576, 1283084, etc.

**Uploaded Files Contain:**
- Orders: 1293599, 1305075, etc.

**Conclusion**: Different order numbers → No matches found

---

## Possible Causes

### 1. **Wrong Schedule Loaded**
- The Excel schedule uploaded doesn't match the actual orders being shipped
- Solution: Upload the correct weekly schedule that contains orders 1293599, 1305075, etc.

### 2. **Order Numbers Changed**
- Customer changed order numbers between schedule creation and shipment
- Solution: Manual linking or schedule update

### 3. **Multiple Schedule Formats**
- Different departments use different order numbering
- Solution: Need to identify which schedule format is correct

### 4. **Outdated Schedule**
- Schedule is from an earlier week, new orders have different numbers
- Solution: Upload current week's schedule

---

## Solutions

### Solution 1: Upload Correct Schedule (RECOMMENDED)
**Best if**: You have the right Excel file but haven't uploaded it yet

**Steps:**
1. Get the weekly delivery schedule Excel file that contains orders 1293599, 1305075, etc.
2. Go to "Import XML File" page → "Weekly Delivery Schedule" section
3. Click "Load Schedule" to upload the correct .xlsx file
4. System will automatically backfill and link previously unlinked files

**Pros**: 
- Automatic linking
- Clean data
- Works for future uploads

### Solution 2: Manual Linking (Current Workaround)
**Best if**: Schedule won't be available or orders are one-off

**Steps:**
1. Go to "Import XML File" page → "Uploaded Files" section
2. Find the unlinked file (shows "Unlinked" badge)
3. Click "Edit" button
4. Enter: FTM Indent, Style, Color, Quantity
5. Click "Save"

**Pros**:
- Works immediately
- No schedule needed

**Cons**:
- Manual work for each file
- Error-prone

### Solution 3: Enhanced Fuzzy Matching (Development Required)
**Best if**: Order numbers have consistent patterns but slight variations

Would require code changes to:
- Match partial order numbers
- Match by alternate fields (style/color/indent)
- Support order number prefixes/suffixes

---

## Immediate Action Items

### Option A: Get the Right Schedule
1. **Identify which week's schedule matches these orders**
   - Ask: Which week are orders 1293599, 1305075 scheduled for?
   - Get that week's Excel file from scheduling department

2. **Upload the schedule**
   - Use the "Load Schedule" feature
   - System will auto-link existing files

3. **Verify**
   - Use Schedule Diagnostic page to check matches

### Option B: Manual Link for Now
1. For each unlinked file, click "Edit"
2. Enter FTM indent, style, color, quantity
3. Save

### Option C: Investigate Data Mismatch
1. Check with scheduling: Are these order numbers correct?
2. Verify .mrpg files are for the right orders
3. May need to re-export files with correct order numbers

---

## Technical Details (For Developers)

### Key Files
- `backend/includes/schedule_lookup.php` - Matching logic
- `backend/api/preview_mrpg.php` - Preview and match on upload
- `backend/api/upload.php` - Import with or without schedule
- `frontend/src/pages/FileUpload.js` - UI for upload and linking
- `frontend/src/pages/ScheduleDiagnostic.js` - Diagnostic tool

### Database Tables
```sql
-- Schedules
delivery_schedules (id, week_label, file_name, order_count, is_active)
delivery_schedule_orders (schedule_id, order_no, indent_no, description, colour, order_qty)

-- Files
shipments (
    customer_order_no,      -- From .mrpg file
    schedule_id,            -- Matched schedule
    schedule_status,        -- 'linked', 'unlinked', 'manual'
    internal_po_number,     -- FTM-xxxxx
    style, color, order_qty
)
```

### Match Query
```php
// Current exact match only
$stmt = $pdo->prepare(
    'SELECT order_no, indent_no, description, colour, order_qty
     FROM delivery_schedule_orders
     WHERE order_no = ?'  // <-- Exact match required
);
```

---

## Next Steps

**Please choose one:**

1. **"I have the correct schedule file"**
   → Upload it, system will auto-link

2. **"I don't have a schedule for these orders"**
   → Manual linking for each file

3. **"I need to investigate why order numbers don't match"**
   → Use diagnostic tool, check with scheduling dept

4. **"I want enhanced matching features"**
   → Development work required (fuzzy matching, alternate keys)

---

**Which path should we take?**

# Schedule Linking Problem - Quick Fix Guide

## The Problem
Your uploaded .mrpg files show as "unlinked" because their customer order numbers don't match any orders in your loaded schedules.

---

## Root Cause Identified

**From your diagnostic results:**
- ❌ **Files contain orders**: 1293599, 1305075, etc.
- ❌ **Schedules contain orders**: 1212657, 1249576, 1283084, etc.
- ❌ **Result**: No matches → Files remain unlinked

**These are completely different order numbers**, so the system cannot auto-link them.

---

## Solutions (Choose One)

### ✅ Option 1: Upload the Correct Schedule (RECOMMENDED)

**When to use**: You have an Excel schedule that contains orders 1293599, 1305075, etc.

**Steps:**
1. Navigate to: **Import XML File** page
2. Find the section: **"Weekly Delivery Schedule"**
3. Select your Excel file (.xlsx) that contains the correct order numbers
4. Click **"Load Schedule"**
5. ✅ The system will automatically detect and link existing unlinked files

**Result**: Automatic linking of all matching files + future uploads will auto-link

---

### ✅ Option 2: Manual Linking

**When to use**: You don't have a schedule OR these are special/one-off orders

**Steps:**
1. Go to: **Import XML File** page
2. Scroll to: **"Uploaded Files"** section
3. Find files with "Unlinked" badge
4. Click **"Edit"** button for each file
5. Fill in:
   - FTM Indent (the number after FTM-)
   - Style
   - Color
   - Quantity
6. Click **Save**

**Result**: File is manually linked and ready to use

---

### ✅ Option 3: Investigate Data Mismatch

**When to use**: You're not sure why order numbers are different

**Questions to answer:**
1. Are orders 1293599, 1305075 the correct orders for these shipments?
2. Which week are these orders supposed to ship?
3. Did customer change order numbers after schedule was created?
4. Are you using the Excel schedule from the correct week?

**Action**: Contact your scheduling department to clarify

---

## Using Your Tools

### Schedule Diagnostic Tool
**Location**: Navigation menu → "Schedule Diagnostic"

**Shows you:**
- How many unlinked files you have
- What order numbers are in files vs schedules
- Which matches are found (exact, partial, none)
- Suggested actions for each file

### Import Page Features
**Location**: Navigation menu → "Import XML File"

**You can:**
- Upload new weekly schedules
- View all uploaded files (linked and unlinked)
- Manually edit any file's details
- Delete incorrectly uploaded files
- See backfill suggestions after uploading schedule

---

## What Happens When You Upload a Schedule

1. **System indexes all orders** in the Excel file
2. **Scans all unlinked files** in your system
3. **Matches by customer order number**
4. **Shows backfill candidates** (files that can now be linked)
5. **You review and approve** which ones to link
6. **System updates** approved files with FTM indent, style, color

**Smart Features:**
- Safe auto-selection (no conflicts)
- Manual review for conflicts
- Shows what will change before applying

---

## Common Scenarios

### Scenario A: Wrong Week's Schedule
**Problem**: You uploaded Week 23's schedule, but files are from Week 24
**Solution**: Upload Week 24's schedule → auto-links files

### Scenario B: Orders Not in Any Schedule Yet
**Problem**: Orders are too new, schedule not ready
**Solution**: Manual linking for now, upload schedule later

### Scenario C: Order Numbers Changed
**Problem**: Customer updated order numbers after schedule created
**Solution**: Get updated schedule or manual linking

### Scenario D: Testing/Sample Orders
**Problem**: These aren't real production orders
**Solution**: Manual linking with custom details

---

## Next Steps - Your Decision

**Please tell me which scenario applies:**

1. **"I have the correct schedule file, just haven't uploaded it yet"**
   → I'll guide you through uploading it

2. **"I don't know which schedule file to use"**
   → Let's identify which week these orders belong to

3. **"These orders aren't in any schedule"**
   → I'll show you how to manual link efficiently

4. **"I want to understand the technical details better"**
   → See SCHEDULE_LINKING_SOLUTION.md for full technical documentation

---

## Quick Actions You Can Take Right Now

### Check What Schedules Are Loaded
1. Go to: Import XML File page
2. Look at: "Weekly Delivery Schedule" section
3. See: "Uploaded schedules" table
4. Note: Which weeks are loaded (e.g., Week 024)

### Check Your Unlinked Files
1. Go to: Schedule Diagnostic page
2. See: Complete list of unlinked files
3. Note: Order numbers that couldn't be matched

### Try the Backfill Feature
1. Go to: Import XML File page
2. Click: "Find orders to link" button (bottom of schedule section)
3. See: If any current schedules can link existing files

---

**What would you like to do first?**

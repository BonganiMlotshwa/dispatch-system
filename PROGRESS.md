# Progress — FTM Dispatch System

Last updated: 2026-09-22

---

## Session 2026-09-22

### 1. Admin-only user management

Only admins can now add, delete or manage users, and the sidebar show/hide
toggle is admin-only.

- `frontend/src/pages/UserManagement.js` — reads the role via `getUser()` from
  `authService` and gates the UI on `currentUser?.role === 'admin'`.
- Hidden from non-admins: the App Settings tab, Add User, Audit Log, and the
  per-row Edit / Password / Activate / Delete buttons (non-admins see `—`).
- The backend already enforced this via `requireAdmin()` in
  `user_management.php`. This change closes the gap in the UI only.

### 2. Schedule matching bug — multi-sheet Excel files

**Symptom:** a `.mrpg` file would not match WEEK 039 even though the order was
visible in the spreadsheet by hand.

**Cause:** `scheduleReadSheetRows()` in `backend/includes/schedule_parser.php`
read only `xl/worksheets/sheet1.xml`. WEEK 039.xlsx has 9 sheets, one per
sewing line, and the order in question sat on sheet 9.

**Fix:** the function now takes a `$sheetNumber` parameter, and
`scheduleParseXlsx()` loops sheets 1–50, stopping at the first empty one. Orders
are collected from every sheet that has ORDER NO + INDENT NO headers and
deduplicated on the normalised order number.

**Result:** WEEK 039 now parses **35 orders** (previously 26). Order 1539150
correctly resolves to indent 17105.

### 3. Print labels from inside an order

New **Labels** tab on the PO Details page (`/po/:id`) so carton stickers can be
printed without going to the separate Label Generator.

- `frontend/src/pages/PODetails.js` — added `loadLabels` (fetches
  `stickers.php?ftm_po=<internal_po_number>`), `handlePrintLabels`, the Labels
  tab, a checkbox table with select-all/clear, and a preview modal.
- Print output reuses the Label Generator layout: CODE128 barcode via JsBarcode
  plus a QR code, 3 per row, A4 landscape.

> **Not yet verified in a browser.** The build compiles clean but the tab has not
> been opened and printed. FTM-17105 now has its 708 cartons, so it can be
> tested against a real order.

### 4. Dashboard cards reworked

The first card had been showing cartons already scanned in, not what was
expected from orders. Card set is now:

| Card | Counts | Behaviour |
|---|---|---|
| Cartons Expected | All cartons on orders with ≥1 unscanned carton | Order-level — whole order drops off when its last carton is scanned |
| Pending Cartons | Cartons not yet scanned | Decrements per scan |
| Cartons Received | Cartons at status `entered` | **Per carton** — each scan visible immediately |
| Units Received | `SUM(units)` where status `entered` | System only, no legacy figures |

- Received was first built order-level (0 until an order completed). That was
  rejected after 18 of 708 scans left the card reading 0 — no live feedback.
  Changed to per-carton by decision. Do not revert this.
- `Prev. Year Cartons` card removed, replaced by `Units Received`.
- `Total Orders` renamed **Current Orders** (it is year-filtered, so "total" was
  misleading) and moved to lead row 3.
- Backend key `received_orders` renamed `received_cartons` to match what it
  counts.

Files: `backend/api/dashboard_stats.php`, `frontend/src/pages/Dashboard.js`.

### 5. Previous Year Orders page — now actually previous-year

The page was listing current system orders alongside legacy ones, so live 2026
orders (FTM-17105, FTM-120288) appeared under "Previous Year Orders".

**Cause:** `warehouse_stock_list.php` merged two sources — `legacy_warehouse_goods`
*and* every row in `shipments` tagged `system-<id>`. The page had been renamed in
commit `f1605fbb` but the query was never narrowed.

**Fix:** removed the shipments block (lines 109–190). The endpoint returns legacy
rows only. It had exactly one caller, so nothing else is affected.

**Result:** page shows 17 rows, matching the "Prev. Year Orders" card. Those two
numbers previously disagreed.

---

## Data incident — carton rows deleted 2026-09-22

Roughly 15,882 rows vanished from `cartons` (0 rows, AUTO_INCREMENT at 15883).
Neither delete path in the code explained it: `delete_po.php` removes the parent
shipment too, and the shipment rows were still present.

**Confirmed by the user as a manual phpMyAdmin operation.** Not a code defect.

Recovered by re-importing FTM-17105 and WEEK 039 at 16:18. Current state:

| Order | Total | Pending | Entered | Exited |
|---|---|---|---|---|
| FTM-17105 | 708 | 690 | 18 | 0 |
| FTM-120288 | 295 | 0 | 0 | 295 |

> If other orders existed in that table before the delete, their carton history
> is gone and re-importing the `.mrpg` files is the only way back. Not yet
> checked whether anything else is missing.

---

## Open items

### Needs testing
- **Labels tab on PO Details** — compiles, never opened in a browser. Test print
  against FTM-17105.
- **Previous Year Orders page** — confirm it renders with system rows gone; the
  status filter counts will have shifted down.

### Known issues, not yet addressed
- **Legacy units ignore the year filter.** The `legacy_warehouse_goods` query in
  `dashboard_stats.php` has no year condition, so all 92,336 legacy units are
  added regardless of the year selected. Affects Total Units and Units in Factory.
- **Cancelled stock counts as live.** 43,133 units across 6 cancelled orders —
  47% of the legacy total — sit inside Total Units and Units in Factory as though
  they were real stock.
- **Possible duplicate legacy rows.** ids 14 and 15 are identical in every field
  (OTB, `waiting_for_booking`, 10,620 units, 295 cartons, `internal_po`
  FTM-00000). If that is a double entry the total is overstated by 10,620 units.
  *Check against the source before acting.*
- **Four legacy rows have no PO number** — ids 14, 15, 20, 27 all carry
  FTM-00000, together 30,686 units. Hard to trace.
- **Dead frontend branches.** `LegacyWarehouseGoods.js` still checks
  `row.source_type === 'system'` (line ~159) and posts to
  `update_shipment_warehouse_status.php`. Unreachable now. Harmless; left in
  place to keep the change small.

### Uncommitted
Everything above is uncommitted. Last commit is `693ada58`.

```
M  backend/.htaccess
M  backend/api/dashboard_stats.php
M  backend/api/warehouse_stock_list.php
M  backend/includes/cors.php
M  backend/includes/schedule_parser.php
M  frontend/src/components/Sidebar.js
M  frontend/src/pages/Dashboard.js
M  frontend/src/pages/PODetails.js
M  frontend/src/pages/UserManagement.js
?? backend/api/app_settings.php
?? frontend/src/pages/AdminSettings.js
?? warehouse_tracking (5).sql
```

> `warehouse_tracking (5).sql` is an untracked database dump. Check what is in it
> before committing — dumps can carry credentials or personal data and generally
> do not belong in the repo.

---

## Earlier sessions

- **2026-09-19** — Prev Year Orders rename, year filter, truck summary customer
  and scan fixes, ship modal customer, scanned-by column, status bug fix.
  Commit `f1605fbb`.
- **2026-09-04** — Linux migration audit. 5 fixes still pending: upload.php path,
  config.js API URL, DB credentials, CORS origins, logo path. Server setup steps
  still to be written.
- **2026-08-27** — Legacy shipping visibility: dashboard status cards, shipped
  cards view, WeeklyAnalysis outbound, DailySummary legacy section.

<?php
/**
 * Combined warehouse stock list: manual legacy entries + system purchase orders.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';
require_once '../includes/warehouse_order_statuses.php';
require_once '../includes/legacy_warehouse_statuses.php';
require_once '../includes/po_helpers.php';

try {
    $pdo = getDbConnection();
    $options = warehouseOrderStatusOptions();
    $items = [];
    $statusCounts = array_fill_keys(array_keys($options), 0);

    $statusFilter = !empty($_GET['status']) ? normalizeWarehouseOrderStatus($_GET['status']) : '';
    $customerFilter = !empty($_GET['customer']) ? $_GET['customer'] : '';
    $yearFilter = isset($_GET['source_year']) && $_GET['source_year'] !== '' ? (int)$_GET['source_year'] : null;
    $inWarehouseOnly = !empty($_GET['in_warehouse_only']) && $_GET['in_warehouse_only'] !== '0';
    $search = !empty($_GET['search']) ? trim($_GET['search']) : '';

    // --- Manual legacy rows ---
    $legacyExists = (bool)$pdo->query("SHOW TABLES LIKE 'legacy_warehouse_goods'")->fetch();
    if ($legacyExists) {
        $lw = ['1=1'];
        $lp = [];
        if ($statusFilter) {
            $lw[] = 'l.status = ?';
            $lp[] = $statusFilter;
        }
        if ($customerFilter) {
            $lw[] = 'l.customer = ?';
            $lp[] = $customerFilter;
        }
        if ($yearFilter) {
            $lw[] = 'l.source_year = ?';
            $lp[] = $yearFilter;
        }
        if ($inWarehouseOnly) {
            $lw[] = "l.status = 'active'";
        }
        if ($search) {
            $q = '%' . $search . '%';
            $lw[] = '(l.internal_po LIKE ? OR l.customer_order_number LIKE ? OR l.style LIKE ? OR l.color LIKE ? OR l.remarks LIKE ? OR l.new_developments LIKE ?)';
            array_push($lp, $q, $q, $q, $q, $q, $q);
        }

        $stmt = $pdo->prepare('SELECT l.* FROM legacy_warehouse_goods l WHERE ' . implode(' AND ', $lw));
        $stmt->execute($lp);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $st = normalizeLegacyWarehouseStatus($row['status']);
            $statusCounts[$st] = ($statusCounts[$st] ?? 0) + 1;
            $legacyCtns = $row['cartons_count'] !== null ? (int)$row['cartons_count'] : 0;
            // For shipped legacy items all cartons are considered dispatched; for all
            // other statuses they are still counted as in-warehouse.
            $isShipped = ($st === 'shipped');
            $items[] = [
                'id' => 'legacy-' . $row['id'],
                'source_type' => 'legacy',
                'source_id' => (int)$row['id'],
                'internal_po' => $row['internal_po'],
                'customer_order_number' => $row['customer_order_number'],
                'customer' => $row['customer'],
                'customer_other' => $row['customer_other'] ?? null,
                'cartons_label' => $row['cartons_label'] ?? null,
                'cartons_count' => $row['cartons_count'] !== null ? (int)$row['cartons_count'] : null,
                'style' => $row['style'],
                'color' => $row['color'],
                'order_qty' => $row['order_qty'] !== null ? (int)$row['order_qty'] : null,
                'quantity_inside' => $row['quantity_inside'] !== null ? (int)$row['quantity_inside'] : null,
                'shipped_qty' => $row['shipped_qty'] !== null ? (int)$row['shipped_qty'] : null,
                'cartons_in_wh' => $isShipped ? 0 : $legacyCtns,
                'cartons_shipped' => $isShipped ? $legacyCtns : null,
                'cartons_total' => $legacyCtns,
                'cartons_pending' => null,
                'status' => $st,
                'status_label' => $options[$st] ?? $st,
                'remarks' => $row['remarks'],
                'new_developments' => $row['new_developments'],
                'source_year' => $row['source_year'],
                'entry_type' => 'manual_legacy',
            ];
        }
    }

    // --- System purchase orders (shipments) ---
    $hasWhStatus = (bool)$pdo->query("SHOW COLUMNS FROM shipments LIKE 'warehouse_order_status'")->fetch();
    if ($hasWhStatus) {
        $sw = ['1=1'];
        $sp = [];
        if ($statusFilter) {
            $sw[] = 's.warehouse_order_status = ?';
            $sp[] = $statusFilter;
        }
        if ($customerFilter) {
            $sw[] = 's.customer = ?';
            $sp[] = $customerFilter;
        }
        if ($yearFilter) {
            $sw[] = 'YEAR(s.import_date) = ?';
            $sp[] = $yearFilter;
        }
        if ($inWarehouseOnly) {
            $sw[] = "s.warehouse_order_status = 'active'";
        }
        if ($search) {
            $q = '%' . $search . '%';
            $sw[] = '(s.internal_po_number LIKE ? OR s.style LIKE ? OR s.color LIKE ? OR s.file_name LIKE ?)';
            array_push($sp, $q, $q, $q, $q);
        }

        $sql = "
            SELECT s.id, s.internal_po_number, s.customer, s.style, s.color, s.order_qty,
                s.warehouse_order_status, s.entry_type, s.import_date,
                (SELECT COUNT(*) FROM cartons c WHERE c.shipment_id = s.id) AS carton_count,
                (SELECT COUNT(*) FROM cartons c WHERE c.shipment_id = s.id AND c.status = 'entered') AS in_warehouse_count,
                (SELECT COUNT(*) FROM cartons c WHERE c.shipment_id = s.id AND c.status = 'exited') AS shipped_count,
                (SELECT COUNT(*) FROM cartons c WHERE c.shipment_id = s.id AND c.status = 'pending') AS pending_count,
                (SELECT po_number FROM cartons c WHERE c.shipment_id = s.id LIMIT 1) AS customer_po_number,
                (SELECT COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) FROM cartons c WHERE c.shipment_id = s.id AND c.status = 'entered') AS units_inside,
                (SELECT COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) FROM cartons c WHERE c.shipment_id = s.id AND c.status = 'exited') AS units_shipped,
                (SELECT COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) FROM cartons c WHERE c.shipment_id = s.id) AS units_total,
                (SELECT NULLIF(TRIM(c.item), '') FROM cartons c WHERE c.shipment_id = s.id AND c.item IS NOT NULL LIMIT 1) AS style_from_carton
            FROM shipments s
            WHERE " . implode(' AND ', $sw) . "
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($sp);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $st = displayWarehouseOrderStatus($row['warehouse_order_status'] ?? 'active');
            $statusCounts[$st] = ($statusCounts[$st] ?? 0) + 1;
            $totalCtns = (int)$row['carton_count'];
            $inWhCtns = (int)$row['in_warehouse_count'];
            $shippedCtns = (int)$row['shipped_count'];
            $orderQty = $row['order_qty'] !== null && $row['order_qty'] !== ''
                ? (int)$row['order_qty']
                : ((int)$row['units_total'] ?: null);
            $style = trim($row['style'] ?? '') ?: trim($row['style_from_carton'] ?? '');
            $custPo = trim($row['customer_po_number'] ?? '');
            $internalPo = $row['internal_po_number'];
            $orderNum = ($custPo && strcasecmp($custPo, $internalPo) !== 0) ? $custPo : null;

            $items[] = [
                'id' => 'system-' . $row['id'],
                'source_type' => 'system',
                'source_id' => (int)$row['id'],
                'internal_po' => $internalPo,
                'customer_order_number' => $orderNum,
                'customer' => $row['customer'] ?: 'MRP',
                'style' => $style ?: null,
                'color' => trim($row['color'] ?? '') ?: null,
                'order_qty' => $orderQty,
                'quantity_inside' => (int)$row['units_inside'] ?: null,
                'shipped_qty' => (int)$row['units_shipped'] ?: null,
                'cartons_in_wh' => $inWhCtns,
                'cartons_shipped' => $shippedCtns,
                'cartons_total' => $totalCtns,
                'cartons_pending' => (int)$row['pending_count'],
                'status' => $st,
                'status_label' => $options[$st] ?? $st,
                'remarks' => null,
                'new_developments' => null,
                'source_year' => $row['import_date'] ? (int)date('Y', strtotime($row['import_date'])) : null,
                'entry_type' => $row['entry_type'],
            ];
        }
    }

    usort($items, function ($a, $b) {
        return comparePoNumbers($a['internal_po'] ?? '', $b['internal_po'] ?? '');
    });

    echo json_encode([
        'success' => true,
        'items' => $items,
        'count' => count($items),
        'status_counts' => $statusCounts,
        'status_options' => $options,
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

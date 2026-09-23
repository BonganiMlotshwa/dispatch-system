<?php
/**
 * Combined warehouse stock list: manual legacy entries + system purchase orders.
 */
header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['GET']);
require_once '../includes/auth.php';
auth_require_user();

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

        $truckTableExists = (bool)$pdo->query("SHOW TABLES LIKE 'truck_shipments'")->fetch();
        $truckJoin = $truckTableExists
            ? 'LEFT JOIN truck_shipments ts ON ts.id = l.truck_shipment_id'
            : '';
        $truckCols = $truckTableExists
            ? ', ts.truck_reg, ts.driver_name'
            : ', NULL AS truck_reg, NULL AS driver_name';

        $stmt = $pdo->prepare(
            'SELECT l.*' . $truckCols .
            ' FROM legacy_warehouse_goods l ' . $truckJoin .
            ' WHERE ' . implode(' AND ', $lw)
        );
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
                'shipped_at' => $row['shipped_at'] ?? null,
                'shipment_week' => $row['shipment_week'] ?? null,
                'truck_shipment_id' => !empty($row['truck_shipment_id']) ? (int)$row['truck_shipment_id'] : null,
                'truck_reg' => $row['truck_reg'] ?? null,
                'driver_name' => $row['driver_name'] ?? null,
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

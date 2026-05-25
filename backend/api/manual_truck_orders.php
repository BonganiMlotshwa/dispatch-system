<?php
/**
 * List manual-entry orders (OTB, OBSW, etc.) available to assign to a truck at exit.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only GET allowed']);
    exit;
}

require_once '../config/database.php';
require_once '../includes/truck_manual_assign.php';
require_once '../includes/po_helpers.php';

try {
    $pdo = getDbConnection();

    $sql = "
        SELECT
            s.id,
            s.internal_po_number,
            s.customer,
            s.style,
            s.color,
            s.order_qty,
            COUNT(c.id) AS cartons_total,
            SUM(CASE WHEN c.status IN ('pending', 'entered') THEN 1 ELSE 0 END) AS cartons_in_warehouse,
            COALESCE(SUM(CASE WHEN c.status IN ('pending', 'entered') THEN CAST(c.units AS UNSIGNED) ELSE 0 END), 0) AS units_in_warehouse,
            (SELECT po_number FROM cartons WHERE shipment_id = s.id LIMIT 1) AS customer_po_number
        FROM shipments s
        INNER JOIN cartons c ON c.shipment_id = s.id
        WHERE s.entry_type = 'manual'
        GROUP BY s.id, s.internal_po_number, s.customer, s.style, s.color, s.order_qty
        HAVING cartons_in_warehouse > 0
        ORDER BY s.customer ASC, s.internal_po_number ASC
    ";

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $orders = [];
    foreach ($rows as $row) {
        if (!isNonMrpCustomer($row['customer'])) {
            continue;
        }
        $orders[] = [
            'id' => (int)$row['id'],
            'internal_po_number' => formatInternalPoDisplay($row['customer'], $row['internal_po_number']),
            'customer' => $row['customer'],
            'customer_po_number' => formatCustomerPoForDisplay($row['customer'], $row['customer_po_number'] ?? ''),
            'style' => $row['style'],
            'color' => $row['color'],
            'order_qty' => (int)$row['order_qty'],
            'cartons_in_warehouse' => (int)$row['cartons_in_warehouse'],
            'units_in_warehouse' => (int)$row['units_in_warehouse'],
            'cartons_total' => (int)$row['cartons_total']
        ];
    }

    echo json_encode([
        'success' => true,
        'orders' => $orders,
        'count' => count($orders)
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

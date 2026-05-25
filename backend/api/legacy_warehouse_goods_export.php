<?php
/**
 * Export legacy warehouse goods list to CSV (same columns as spreadsheet).
 */
require_once '../config/database.php';
require_once '../includes/legacy_warehouse_statuses.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    $pdo = getDbConnection();
    $options = legacyWarehouseStatusOptions();

    $where = ['1=1'];
    $params = [];
    if (!empty($_GET['status'])) {
        $where[] = 'status = ?';
        $params[] = $_GET['status'];
    }
    if (!empty($_GET['customer'])) {
        $where[] = 'customer = ?';
        $params[] = $_GET['customer'];
    }
    if (!empty($_GET['source_year'])) {
        $where[] = 'source_year = ?';
        $params[] = (int)$_GET['source_year'];
    }
    if (!empty($_GET['in_warehouse_only']) && $_GET['in_warehouse_only'] !== '0') {
        // Keep exports aligned with the screen filter: only rows still marked active.
        $where[] = "status = 'active'";
    }
    if (!empty($_GET['search'])) {
        $q = '%' . trim($_GET['search']) . '%';
        $where[] = '(internal_po LIKE ? OR customer_order_number LIKE ? OR style LIKE ? OR color LIKE ? OR remarks LIKE ? OR new_developments LIKE ?)';
        array_push($params, $q, $q, $q, $q, $q, $q);
    }

    $sql = 'SELECT * FROM legacy_warehouse_goods WHERE ' . implode(' AND ', $where) . ' ORDER BY internal_po ASC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="legacy_warehouse_goods_' . date('Y-m-d') . '.csv"');

    $out = fopen('php://output', 'w');
    fputcsv($out, [
        'PO', 'Order Number', 'Style', 'Colour', 'Order Quantity',
        'Quantity Inside', 'No of Ctns', 'Status', 'Remarks',
        'New Developments', 'Shipped Qty', 'Customer', 'Source Year'
    ]);

    foreach ($rows as $r) {
        $ctns = $r['cartons_label'] ?: ($r['cartons_count'] ? $r['cartons_count'] . ' CTNS' : '');
        fputcsv($out, [
            $r['internal_po'],
            $r['customer_order_number'],
            $r['style'],
            $r['color'],
            $r['order_qty'],
            $r['quantity_inside'],
            $ctns,
            $options[$r['status']] ?? $r['status'],
            $r['remarks'],
            $r['new_developments'],
            $r['shipped_qty'],
            $r['customer'],
            $r['source_year']
        ]);
    }
    fclose($out);
} catch (Exception $e) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

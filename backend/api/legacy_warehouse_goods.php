<?php
/**
 * Legacy warehouse goods — manual entries with status + filters.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';
require_once '../includes/admin_auth.php';
require_once '../includes/legacy_warehouse_statuses.php';

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?: [];

try {
    $pdo = getDbConnection();

    $tableExists = (bool)$pdo->query("SHOW TABLES LIKE 'legacy_warehouse_goods'")->fetch();
    if (!$tableExists) {
        throw new Exception('Legacy warehouse table not found. Run: php backend/migrate_legacy_warehouse_goods.php');
    }

    if ($method === 'GET') {
        $where = ['1=1'];
        $params = [];

        if (!empty($_GET['status'])) {
            $where[] = 'l.status = ?';
            $params[] = $_GET['status'];
        }
        if (!empty($_GET['customer'])) {
            $where[] = 'l.customer = ?';
            $params[] = $_GET['customer'];
        }
        if (!empty($_GET['source_year'])) {
            $where[] = 'l.source_year = ?';
            $params[] = (int)$_GET['source_year'];
        }
        if (!empty($_GET['in_warehouse_only']) && $_GET['in_warehouse_only'] !== '0') {
            // "Inside warehouse" means the row is still active, regardless of whether
            // quantity_inside was manually entered, scanned in, or left blank.
            $where[] = "l.status = 'active'";
        }
        if (!empty($_GET['search'])) {
            $q = '%' . trim($_GET['search']) . '%';
            $where[] = '(l.internal_po LIKE ? OR l.customer_order_number LIKE ? OR l.style LIKE ? OR l.color LIKE ? OR l.remarks LIKE ? OR l.new_developments LIKE ?)';
            array_push($params, $q, $q, $q, $q, $q, $q);
        }

        $whereSql = implode(' AND ', $where);

        $stmt = $pdo->prepare("
            SELECT l.*
            FROM legacy_warehouse_goods l
            WHERE {$whereSql}
            ORDER BY l.updated_at DESC, l.id DESC
        ");
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($items as &$item) {
            $item['status'] = normalizeLegacyWarehouseStatus($item['status']);
        }
        unset($item);

        $statusCounts = [];
        $countStmt = $pdo->query("
            SELECT status, COUNT(*) AS cnt
            FROM legacy_warehouse_goods
            GROUP BY status
        ");
        while ($row = $countStmt->fetch(PDO::FETCH_ASSOC)) {
            $key = normalizeLegacyWarehouseStatus($row['status']);
            $statusCounts[$key] = ($statusCounts[$key] ?? 0) + (int)$row['cnt'];
        }

        echo json_encode([
            'success' => true,
            'items' => $items,
            'count' => count($items),
            'status_counts' => $statusCounts,
            'status_options' => legacyWarehouseStatusOptions()
        ]);
        exit;
    }

    if ($method === 'POST') {
        $row = validateLegacyRow($input);
        $stmt = $pdo->prepare("
            INSERT INTO legacy_warehouse_goods (
                internal_po, customer_order_number, customer, style, color,
                order_qty, quantity_inside, cartons_label, cartons_count,
                status, remarks, new_developments, shipped_qty, source_year
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            $row['internal_po'],
            $row['customer_order_number'],
            $row['customer'],
            $row['style'],
            $row['color'],
            $row['order_qty'],
            $row['quantity_inside'],
            $row['cartons_label'],
            $row['cartons_count'],
            $row['status'],
            $row['remarks'],
            $row['new_developments'],
            $row['shipped_qty'],
            $row['source_year']
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Entry created',
            'id' => (int)$pdo->lastInsertId()
        ]);
        exit;
    }

    if ($method === 'PUT') {
        $id = isset($input['id']) ? (int)$input['id'] : 0;
        if ($id <= 0) {
            throw new Exception('id is required');
        }
        $row = validateLegacyRow($input);
        $stmt = $pdo->prepare("
            UPDATE legacy_warehouse_goods SET
                internal_po = ?, customer_order_number = ?, customer = ?, style = ?, color = ?,
                order_qty = ?, quantity_inside = ?, cartons_label = ?, cartons_count = ?,
                status = ?, remarks = ?, new_developments = ?, shipped_qty = ?, source_year = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $row['internal_po'],
            $row['customer_order_number'],
            $row['customer'],
            $row['style'],
            $row['color'],
            $row['order_qty'],
            $row['quantity_inside'],
            $row['cartons_label'],
            $row['cartons_count'],
            $row['status'],
            $row['remarks'],
            $row['new_developments'],
            $row['shipped_qty'],
            $row['source_year'],
            $id
        ]);

        echo json_encode(['success' => true, 'message' => 'Entry updated']);
        exit;
    }

    if ($method === 'DELETE') {
        requireAdminCode(array_merge($input, $_GET));
        $id = isset($_GET['id']) ? (int)$_GET['id'] : (int)($input['id'] ?? 0);
        if ($id <= 0) {
            throw new Exception('id is required');
        }
        $stmt = $pdo->prepare('DELETE FROM legacy_warehouse_goods WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['success' => true, 'message' => 'Entry deleted']);
        exit;
    }

    throw new Exception('Method not allowed');
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

function validateLegacyRow(array $input) {
    $options = legacyWarehouseStatusOptions();
    $po = normalizeLegacyPo($input['internal_po'] ?? '');
    if ($po === '') {
        throw new Exception('PO (FTM order number) is required');
    }

    $status = normalizeLegacyWarehouseStatus($input['status'] ?? 'active');
    if (!isset($options[$status])) {
        throw new Exception('Invalid status');
    }

    $cartonsLabel = trim($input['cartons_label'] ?? '') ?: null;
    $cartonsCount = isset($input['cartons_count']) && $input['cartons_count'] !== ''
        ? (int)$input['cartons_count']
        : null;
    if ($cartonsCount === null && $cartonsLabel && preg_match('/(\d+)/', $cartonsLabel, $m)) {
        $cartonsCount = (int)$m[1];
    }

    return [
        'internal_po' => $po,
        'customer_order_number' => trim($input['customer_order_number'] ?? '') ?: null,
        'customer' => trim($input['customer'] ?? 'MRP') ?: 'MRP',
        'style' => trim($input['style'] ?? '') ?: null,
        'color' => trim($input['color'] ?? '') ?: null,
        'order_qty' => intOrNull($input['order_qty'] ?? null),
        'quantity_inside' => intOrNull($input['quantity_inside'] ?? null),
        'cartons_label' => $cartonsLabel,
        'cartons_count' => $cartonsCount,
        'status' => $status,
        'remarks' => trim($input['remarks'] ?? '') ?: null,
        'new_developments' => trim($input['new_developments'] ?? '') ?: null,
        'shipped_qty' => (int)($input['shipped_qty'] ?? 0),
        'source_year' => (int)($input['source_year'] ?? 2025),
    ];
}

function intOrNull($v) {
    if ($v === null || $v === '') {
        return null;
    }
    return (int)$v;
}

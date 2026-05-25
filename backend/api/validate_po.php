<?php

/**
 * Validate PO API Endpoint
 *
 * Validates that a PO exists and whether scanning is allowed for the given action.
 * Request: POST { po: string, action: 'enter'|'exit'|'check' }
 * Response: { success, exists, allowed, status, summary, counts }
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Cache-Control, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed']);
    exit;
}

require_once '../config/database.php';
require_once '../includes/po_helpers.php';

try {
    $pdo = getDbConnection();

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!$payload) {
        $payload = $_POST;
    }

    $po = isset($payload['po']) ? trim($payload['po']) : '';
    $action = isset($payload['action']) ? strtolower(trim($payload['action'])) : 'check';

    if ($po === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'PO number is required']);
        exit;
    }

    if (!in_array($action, ['enter', 'exit', 'check'], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action. Use enter, exit, or check']);
        exit;
    }

    $lookupValues = getPoLookupValues($po);
    $matchConditions = [];
    $params = [];

    foreach ($lookupValues as $value) {
        $matchConditions[] = 'LOWER(s.internal_po_number) = LOWER(?)';
        $params[] = $value;
    }

    $poWhere = '(' . implode(' OR ', $matchConditions) . ')';

    $stmt = $pdo->prepare("
        SELECT
            s.id,
            s.internal_po_number,
            s.warehouse_order_status,
            COUNT(c.id) AS total,
            SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN c.status = 'entered' THEN 1 ELSE 0 END) AS entered,
            SUM(CASE WHEN c.status = 'exited' THEN 1 ELSE 0 END) AS exited
        FROM shipments s
        LEFT JOIN cartons c ON c.shipment_id = s.id
        WHERE {$poWhere}
        GROUP BY s.id
        ORDER BY s.id DESC
        LIMIT 1
    ");
    $stmt->execute($params);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $shipmentStatus = strtolower(trim((string)($row['warehouse_order_status'] ?? 'active')));
    $total = (int)($row['total'] ?? 0);
    $pending = (int)($row['pending'] ?? 0);
    $entered = (int)($row['entered'] ?? 0);
    $exited = (int)($row['exited'] ?? 0);

    $exists = !empty($row);
    $fullyShipped = $exists && $exited === $total;
    $allInWarehouse = $exists && !$fullyShipped && $entered === $total && $total > 0;

    $allowed = false;
    $status = 'not_found';
    $summary = 'PO not found in system.';

    if ($exists) {
        if ($shipmentStatus === 'shipped') {
            $status = 'fully_shipped';
            $summary = 'PO found in system, shipped.';
        } elseif ($shipmentStatus !== 'active' && is_string($shipmentStatus) && in_array($shipmentStatus, ['cancelled', 'not_audited', 'failed_audit', 'waiting_for_booking'], true)) {
            $status = $shipmentStatus;
            $summary = 'PO found in system, status is ' . str_replace('_', ' ', $shipmentStatus) . '.';
        } elseif ($fullyShipped) {
            $status = 'fully_shipped';
            $summary = 'PO found in system, shipped.';
        } elseif ($action === 'check') {
            $status = 'found';
            if ($entered > 0) {
                $summary = 'PO found in system, active in warehouse.';
            } elseif ($pending > 0) {
                $summary = 'PO found in system, not yet in warehouse.';
            } else {
                $summary = 'PO found in system.';
            }
        } elseif ($action === 'enter') {
            if ($allInWarehouse) {
                $status = 'all_in_warehouse';
                $summary = 'PO found in system, active in warehouse.';
            } elseif ($pending > 0) {
                $status = 'ready';
                $allowed = true;
                $summary = 'PO found in system, not yet in warehouse.';
            } else {
                $status = 'nothing_to_enter';
                $summary = 'PO found in system, already shipped or closed.';
            }
        } else {
            if ($entered > 0) {
                $status = 'ready';
                $allowed = true;
                $summary = 'PO found in system, active in warehouse.';
            } elseif ($pending > 0) {
                $status = 'none_in_warehouse';
                $summary = 'PO found in system, not yet in warehouse.';
            } else {
                $status = 'nothing_to_exit';
                $summary = 'PO found in system, already shipped or closed.';
            }
        }
    }

    echo json_encode([
        'success' => true,
        'exists' => $exists,
        'allowed' => $allowed,
        'status' => $status,
        'summary' => $summary,
        'counts' => [
            'total' => $total,
            'pending' => $pending,
            'entered' => $entered,
            'exited' => $exited
        ]
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

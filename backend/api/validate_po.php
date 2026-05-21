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
    if (!$payload) { $payload = $_POST; }

    $po = isset($payload['po']) ? trim($payload['po']) : '';
    $action = isset($payload['action']) ? strtolower(trim($payload['action'])) : 'check';

    if ($po === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'PO number is required']);
        exit;
    }

    if (!in_array($action, ['enter', 'exit', 'check'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action. Use enter, exit, or check']);
        exit;
    }

    $lookupValues = getPoLookupValues($po);
    $matchConditions = [];
    $params = [];
    foreach ($lookupValues as $value) {
        $matchConditions[] = '(LOWER(c.po_number) = LOWER(?) OR LOWER(s.internal_po_number) = LOWER(?))';
        $params[] = $value;
        $params[] = $value;
    }
    $poWhere = '(' . implode(' OR ', $matchConditions) . ')';

    $sql = "
        SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN c.status = 'entered' THEN 1 ELSE 0 END) AS entered,
            SUM(CASE WHEN c.status = 'exited' THEN 1 ELSE 0 END) AS exited
        FROM cartons c
        JOIN shipments s ON c.shipment_id = s.id
        WHERE {$poWhere}
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $total = (int)($row['total'] ?? 0);
    $pending = (int)($row['pending'] ?? 0);
    $entered = (int)($row['entered'] ?? 0);
    $exited = (int)($row['exited'] ?? 0);

    $exists = $total > 0;
    $fullyShipped = $exists && $exited === $total;
    $allInWarehouse = $exists && !$fullyShipped && $entered === $total && $total > 0;

    $allowed = false;
    $status = 'not_found';
    $summary = 'Invalid PO — not found in Purchase Orders. Use the FTM PO shown there (e.g. OTTO-852 or FTM-852).';

    if ($exists) {
        if ($fullyShipped) {
            $status = 'fully_shipped';
            $summary = "This PO has been completely shipped — all {$total} carton" . ($total === 1 ? '' : 's') . " have exited the warehouse.";
        } elseif ($action === 'check') {
            $status = 'found';
            $parts = [];
            if ($pending > 0) {
                $parts[] = "{$pending} pending entry";
            }
            if ($entered > 0) {
                $parts[] = "{$entered} in warehouse";
            }
            if ($exited > 0) {
                $parts[] = "{$exited} shipped";
            }
            $detail = $parts ? implode(', ', $parts) : 'no cartons';
            $summary = "PO found ({$total} carton" . ($total === 1 ? '' : 's') . ": {$detail}). Select Enter or Exit Warehouse.";
        } elseif ($action === 'enter') {
            if ($allInWarehouse) {
                $status = 'all_in_warehouse';
                $summary = "All {$total} expected carton" . ($total === 1 ? ' is' : 's are') . " already in the warehouse. Use Exit Warehouse to ship them out.";
            } elseif ($pending > 0) {
                $status = 'ready';
                $allowed = true;
                $summary = "Ready to enter — {$pending} of {$total} carton" . ($total === 1 ? '' : 's') . " still pending warehouse entry.";
            } else {
                $status = 'nothing_to_enter';
                $summary = "Nothing left to enter for this PO ({$entered} in warehouse" . ($exited > 0 ? ", {$exited} already shipped" : '') . ").";
            }
        } else {
            if ($entered > 0) {
                $status = 'ready';
                $allowed = true;
                $summary = "Ready to exit — {$entered} carton" . ($entered === 1 ? '' : 's') . " in warehouse ready to ship.";
            } elseif ($pending > 0) {
                $status = 'none_in_warehouse';
                $summary = "No cartons in warehouse to exit — {$pending} carton" . ($pending === 1 ? '' : 's') . " still need to be entered first.";
            } else {
                $status = 'nothing_to_exit';
                $summary = 'No cartons available to exit for this PO.';
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

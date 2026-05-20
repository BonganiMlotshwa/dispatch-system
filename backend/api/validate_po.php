<?php
/**
 * Validate PO API Endpoint
 *
 * Validates that a PO exists and whether scanning is allowed for the given action.
 * Request: POST { po: string, action: 'enter'|'exit' }
 * Response: { success, exists, allowed, summary, counts: { total, pending, entered, exited } }
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

try {
    $pdo = getDbConnection();

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!$payload) { $payload = $_POST; }

    $po = isset($payload['po']) ? trim($payload['po']) : '';
    $action = isset($payload['action']) ? strtolower(trim($payload['action'])) : '';

    if ($po === '' || !in_array($action, ['enter', 'exit'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid input. Required: po, action']);
        exit;
    }

    // Aggregate counts for the PO; match either cartons.po_number or shipments.internal_po_number
    $sql = "
        SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN c.status = 'entered' THEN 1 ELSE 0 END) AS entered,
            SUM(CASE WHEN c.status = 'exited' THEN 1 ELSE 0 END) AS exited
        FROM cartons c
        JOIN shipments s ON c.shipment_id = s.id
        WHERE c.po_number = ? OR s.internal_po_number = ?
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$po, $po]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $total = (int)($row['total'] ?? 0);
    $pending = (int)($row['pending'] ?? 0);
    $entered = (int)($row['entered'] ?? 0);
    $exited = (int)($row['exited'] ?? 0);

    $exists = $total > 0;
    $fullyExited = $exists && $exited === $total;

    $allowed = false;
    if ($exists && !$fullyExited) {
        if ($action === 'enter') {
            // Allow enter if any pending cartons remain
            $allowed = $pending > 0;
        } else { // exit
            // Allow exit if any cartons are currently in warehouse
            $allowed = $entered > 0;
        }
    }

    $summary = 'PO not found';
    if ($exists) {
        if ($fullyExited) {
            $summary = 'All cartons for this PO have exited (scanning complete)';
        } else if ($action === 'enter') {
            $summary = $allowed ? 'PO valid: pending cartons available to enter' : 'No pending cartons left to enter';
        } else {
            $summary = $allowed ? 'PO valid: cartons available to exit' : 'No cartons available to exit (none in warehouse)';
        }
    }

    echo json_encode([
        'success' => true,
        'exists' => $exists,
        'allowed' => $allowed,
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



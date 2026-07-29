<?php
/**
 * Live carton-count progress for a single PO.
 *
 * Used by the scanner page to show a shared progress bar that reflects
 * the work of ALL scanners working the same order simultaneously.
 *
 * GET ?po=FTM-12345
 * Returns: { success, found, po, shipment_id, total, pending, entered, exited, last_scan_at }
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';

try {
    $pdo = getDbConnection();

    $po = trim($_GET['po'] ?? '');
    if ($po === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'po is required']);
        exit;
    }

    $shipStmt = $pdo->prepare(
        'SELECT id FROM shipments WHERE internal_po_number = ? LIMIT 1'
    );
    $shipStmt->execute([$po]);
    $shipment = $shipStmt->fetch(PDO::FETCH_ASSOC);

    if (!$shipment) {
        echo json_encode(['success' => true, 'found' => false, 'po' => $po]);
        exit;
    }

    $shipmentId = (int) $shipment['id'];

    $stmt = $pdo->prepare(
        "SELECT
            COUNT(*)                    AS total,
            SUM(status = 'pending')     AS pending,
            SUM(status = 'entered')     AS entered,
            SUM(status = 'exited')      AS exited,
            MAX(scan_timestamp)         AS last_scan_at
         FROM cartons
         WHERE shipment_id = ?"
    );
    $stmt->execute([$shipmentId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success'      => true,
        'found'        => true,
        'po'           => $po,
        'shipment_id'  => $shipmentId,
        'total'        => (int) $row['total'],
        'pending'      => (int) $row['pending'],
        'entered'      => (int) $row['entered'],
        'exited'       => (int) $row['exited'],
        'last_scan_at' => $row['last_scan_at'],
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

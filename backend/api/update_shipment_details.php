<?php
/**
 * Update Shipment Details API
 * Links an unlinked/pending shipment to a schedule by updating PO number, style, color, and quantity.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed']);
    exit;
}

require_once '../config/database.php';

$data = json_decode(file_get_contents('php://input'), true) ?: [];

$shipmentId       = isset($data['shipment_id']) ? (int)$data['shipment_id'] : 0;
$internalPoNumber = trim($data['internal_po_number'] ?? '');
$style            = trim($data['style'] ?? '');
$color            = trim($data['color'] ?? '');
$quantity         = trim($data['quantity'] ?? '');

if ($shipmentId <= 0 || !$internalPoNumber || !$style || !$color || !$quantity) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'shipment_id, internal_po_number, style, color, and quantity are all required']);
    exit;
}

// Normalize PO number — ensure FTM- prefix
if (!preg_match('/^FTM-/i', $internalPoNumber)) {
    $internalPoNumber = 'FTM-' . ltrim($internalPoNumber, '-');
}
$internalPoNumber = strtoupper($internalPoNumber);

try {
    $pdo = getDbConnection();

    // Verify shipment exists
    $stmt = $pdo->prepare("SELECT id, internal_po_number FROM shipments WHERE id = ?");
    $stmt->execute([$shipmentId]);
    $shipment = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$shipment) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Shipment not found']);
        exit;
    }

    // Check if new PO number already exists on a DIFFERENT shipment
    $stmt = $pdo->prepare("SELECT id FROM shipments WHERE internal_po_number = ? AND id != ?");
    $stmt->execute([$internalPoNumber, $shipmentId]);
    $conflict = $stmt->fetch();

    if ($conflict) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => "PO number {$internalPoNumber} is already assigned to another shipment (ID: {$conflict['id']}). Please check the PO number."
        ]);
        exit;
    }

    // Update the shipment
    $stmt = $pdo->prepare("
        UPDATE shipments SET
            internal_po_number = ?,
            style = ?,
            color = ?,
            order_qty = ?,
            updated_at = NOW()
        WHERE id = ?
    ");
    $stmt->execute([$internalPoNumber, $style, $color, (int)$quantity, $shipmentId]);

    echo json_encode([
        'success' => true,
        'message' => "Shipment linked to {$internalPoNumber}",
        'shipment_id' => $shipmentId,
        'internal_po_number' => $internalPoNumber
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}

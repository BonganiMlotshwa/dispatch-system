<?php
/**
 * Update PO Number API Endpoint
 *
 * Updates the internal PO number for a shipment
 */

header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['POST']);
require_once '../includes/auth.php';
auth_require_user();

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/po_helpers.php';

$pdo = getDbConnection();

try {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);

    if (!isset($input['id']) || !isset($input['internal_po_number'])) {
        throw new Exception('Missing required fields: id and internal_po_number');
    }

    $id = intval($input['id']);
    $newPONumber = normalizeOrderNumber(trim($input['internal_po_number']));

    if (empty($newPONumber)) {
        throw new Exception('PO number cannot be empty');
    }

    $checkStmt = $pdo->prepare("
        SELECT id FROM shipments
        WHERE internal_po_number = ? AND id != ?
    ");
    $checkStmt->execute([$newPONumber, $id]);

    if ($checkStmt->fetch()) {
        throw new Exception('PO number already exists');
    }

    $stmt = $pdo->prepare("
        UPDATE shipments
        SET internal_po_number = ?
        WHERE id = ?
    ");
    $stmt->execute([$newPONumber, $id]);

    if ($stmt->rowCount() === 0) {
        throw new Exception('PO not found or no changes made');
    }

    $cartonCountStmt = $pdo->prepare("SELECT COUNT(*) as carton_count FROM cartons WHERE shipment_id = ?");
    $cartonCountStmt->execute([$id]);
    $cartonCount = $cartonCountStmt->fetch()['carton_count'];

    echo json_encode([
        'success' => true,
        'message' => 'PO number updated successfully',
        'data' => [
            'id' => $id,
            'internal_po_number' => $newPONumber,
            'associated_cartons' => $cartonCount
        ]
    ]);

} catch (Exception $e) {
    error_log("update_po_number.php: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

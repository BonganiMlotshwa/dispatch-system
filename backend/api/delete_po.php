<?php
/**
 * Delete PO API Endpoint
 *
 * Deletes a shipment and all associated cartons
 */

header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['POST']);
require_once '../includes/auth.php';
auth_require_user();

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/admin_auth.php';

$pdo = getDbConnection();

try {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);

    if (!isset($input['id'])) {
        throw new Exception('Missing required field: id');
    }

    requireAdminCode($input);

    $id = intval($input['id']);

    $pdo->beginTransaction();

    try {
        $stmt = $pdo->prepare("SELECT internal_po_number FROM shipments WHERE id = ?");
        $stmt->execute([$id]);
        $shipment = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$shipment) {
            throw new Exception('PO not found');
        }

        $deleteCartonsStmt = $pdo->prepare("DELETE FROM cartons WHERE shipment_id = ?");
        $deleteCartonsStmt->execute([$id]);
        $deletedCartons = $deleteCartonsStmt->rowCount();

        $deleteShipmentStmt = $pdo->prepare("DELETE FROM shipments WHERE id = ?");
        $deleteShipmentStmt->execute([$id]);

        if ($deleteShipmentStmt->rowCount() === 0) {
            throw new Exception('Failed to delete shipment');
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'PO deleted successfully',
            'data' => [
                'id' => $id,
                'internal_po_number' => $shipment['internal_po_number'],
                'deleted_cartons' => $deletedCartons
            ]
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }

} catch (Exception $e) {
    error_log("delete_po.php: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

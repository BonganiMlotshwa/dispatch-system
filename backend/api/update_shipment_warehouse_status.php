<?php
/**
 * Update spec 1.5 warehouse order status on a shipment (PO).
 */
header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['POST']);
require_once '../includes/auth.php';
auth_require_user();

require_once '../config/database.php';
require_once '../includes/warehouse_order_statuses.php';

try {
    $pdo = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];

    $id = (int)($input['shipment_id'] ?? $input['id'] ?? 0);
    if ($id <= 0) {
        throw new Exception('shipment_id is required');
    }

    $status = normalizeWarehouseOrderStatus($input['warehouse_order_status'] ?? '');
    $options = warehouseOrderStatusOptions();
    if (!isset($options[$status])) {
        throw new Exception('Invalid warehouse order status');
    }

    $stmt = $pdo->prepare('UPDATE shipments SET warehouse_order_status = ? WHERE id = ?');
    $stmt->execute([$status, $id]);

    if ($stmt->rowCount() === 0) {
        throw new Exception('Shipment not found');
    }

    echo json_encode([
        'success' => true,
        'message' => 'Warehouse order status updated',
        'warehouse_order_status' => $status,
        'warehouse_order_status_label' => $options[$status]
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

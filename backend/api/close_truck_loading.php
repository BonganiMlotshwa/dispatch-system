<?php
/**
 * Mark a truck shipment as closed (loading finished).
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';

try {
    $pdo = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    $id = isset($input['id']) ? (int)$input['id'] : 0;

    if ($id <= 0) {
        throw new Exception('Truck id is required');
    }

    $stmt = $pdo->prepare("
        UPDATE truck_shipments
        SET loading_status = 'closed', updated_at = NOW()
        WHERE id = ?
    ");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        throw new Exception('Truck not found');
    }

    echo json_encode([
        'success' => true,
        'message' => 'Truck loading marked as complete'
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

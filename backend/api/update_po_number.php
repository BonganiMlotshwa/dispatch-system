<?php
/**
 * Update PO Number API Endpoint
 * 
 * Updates the internal PO number for a shipment
 */

// Enable error logging
error_reporting(E_ALL);
ini_set('display_errors', 1);
error_log("=== UPDATE PO NUMBER REQUEST RECEIVED ===");

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    error_log("OPTIONS request received");
    exit(0);
}

error_log("Request method: " . $_SERVER['REQUEST_METHOD']);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/po_helpers.php';

// Get database connection
$pdo = getDbConnection();
error_log("Database connection established");

try {
    // Get JSON input
    $rawInput = file_get_contents('php://input');
    error_log("Raw input: " . $rawInput);
    
    $input = json_decode($rawInput, true);
    error_log("Decoded input: " . print_r($input, true));
    
    if (!isset($input['id']) || !isset($input['internal_po_number'])) {
        error_log("Missing required fields");
        throw new Exception('Missing required fields: id and internal_po_number');
    }
    
    $id = intval($input['id']);
    $newPONumber = normalizeOrderNumber(trim($input['internal_po_number']));
    
    error_log("Updating PO ID: " . $id . " to: " . $newPONumber);
    
    if (empty($newPONumber)) {
        throw new Exception('PO number cannot be empty');
    }
    
    // Check if PO number already exists for a different shipment
    $checkStmt = $pdo->prepare("
        SELECT id FROM shipments 
        WHERE internal_po_number = ? AND id != ?
    ");
    $checkStmt->execute([$newPONumber, $id]);
    
    if ($checkStmt->fetch()) {
        error_log("PO number already exists");
        throw new Exception('PO number already exists');
    }
    
    // Update the PO number in shipments table
    $stmt = $pdo->prepare("
        UPDATE shipments 
        SET internal_po_number = ?
        WHERE id = ?
    ");
    
    $stmt->execute([$newPONumber, $id]);
    
    error_log("Rows affected in shipments: " . $stmt->rowCount());
    
    if ($stmt->rowCount() === 0) {
        throw new Exception('PO not found or no changes made');
    }
    
    // Get count of associated cartons for info
    $cartonCountStmt = $pdo->prepare("
        SELECT COUNT(*) as carton_count FROM cartons WHERE shipment_id = ?
    ");
    $cartonCountStmt->execute([$id]);
    $cartonCount = $cartonCountStmt->fetch()['carton_count'];
    
    error_log("Associated cartons: " . $cartonCount);
    
    $response = [
        'success' => true,
        'message' => 'PO number updated successfully',
        'data' => [
            'id' => $id,
            'internal_po_number' => $newPONumber,
            'associated_cartons' => $cartonCount
        ]
    ];
    
    error_log("Success response: " . json_encode($response));
    echo json_encode($response);
    
} catch (Exception $e) {
    error_log("Error in update_po_number.php: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

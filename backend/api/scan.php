<?php
/**
 * Carton Scanning API Endpoint
 * 
 * This endpoint handles carton scanning for warehouse entry and exit.
 */

// Set headers for API response
header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['POST']);

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed']);
    exit;
}

// Include required files
require_once '../config/database.php';
require_once '../includes/carton_scanner.php';

try {
    // Get database connection
    $pdo = getDbConnection();
    
    // Get JSON input
    $jsonInput = file_get_contents('php://input');
    $data = json_decode($jsonInput, true);
    
    // Debug logging
    file_put_contents(__DIR__ . '/../../debug_log.txt', date('Y-m-d H:i:s') . ' - Scan Request: ' . $jsonInput . "\n", FILE_APPEND);
    
    // Validate input
    if (!$data || !isset($data['barcode']) || !isset($data['action'])) {
        throw new Exception('Invalid input. Required fields: barcode, action');
    }
    
    $barcode = trim($data['barcode']);
    $action = strtolower(trim($data['action']));
    
    // Validate barcode
    if (empty($barcode)) {
        throw new Exception('Barcode cannot be empty');
    }
    
    // Validate action
    if (!in_array($action, ['enter', 'exit'])) {
        throw new Exception('Invalid action. Must be "enter" or "exit"');
    }
    
    // Optional expected PO
    $expectedPo = isset($data['expected_po']) ? trim($data['expected_po']) : null;
    
    // Optional truck shipment ID for exit scans
    $truckShipmentId = isset($data['truck_shipment_id']) ? intval($data['truck_shipment_id']) : null;

    if ($action === 'exit' && !$truckShipmentId) {
        throw new Exception('Truck assignment is required for exit scans.');
    }
    
    // Optional notes
    $notes = isset($data['notes']) ? trim($data['notes']) : null;

    // Process the scan
    $result = processCartonScan($barcode, $action, $pdo, $expectedPo, $truckShipmentId, $notes);
    
    if (!$result['success']) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => $result['message'],
            'error_code' => isset($result['error_code']) ? $result['error_code'] : 'UNKNOWN'
        ]);
        exit;
    }
    
    // Return success response
    echo json_encode($result);
    
} catch (Exception $e) {
    http_response_code(400); // Bad Request
    
    // Debug logging
    file_put_contents(__DIR__ . '/../../debug_log.txt', date('Y-m-d H:i:s') . ' - Scan Error: ' . $e->getMessage() . "\n", FILE_APPEND);
    
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

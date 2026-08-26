<?php
/**
 * Update Carton Data API Endpoint
 * 
 * This endpoint handles updating carton data like QC number, Finishing number, and Notes.
 */

// Set headers for API response
header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['POST']);
require_once '../includes/auth.php';
auth_require_user();

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
    
    // Validate input
    if (!$data || !isset($data['barcode'])) {
        throw new Exception('Invalid input. Required field: barcode');
    }
    
    $barcode = trim($data['barcode']);
    
    // Validate barcode
    if (empty($barcode)) {
        throw new Exception('Barcode cannot be empty');
    }
    
    // Prepare update data
    $updateData = [];
    
    // Check for fields to update
    if (isset($data['qc_number'])) {
        $updateData['qc_number'] = trim($data['qc_number']);
    }
    
    if (isset($data['finishing_number'])) {
        $updateData['finishing_number'] = trim($data['finishing_number']);
    }
    
    if (isset($data['notes'])) {
        $updateData['notes'] = trim($data['notes']);
    }
    
    // Ensure at least one field is being updated
    if (empty($updateData)) {
        throw new Exception('No update data provided');
    }
    
    // Update the carton data
    $result = updateCartonData($barcode, $updateData, $pdo);
    
    if (!$result['success']) {
        throw new Exception($result['message']);
    }
    
    // Get updated carton details
    $cartonDetails = getCartonDetails($barcode, $pdo);
    
    // Return success response with updated data
    echo json_encode([
        'success' => true,
        'message' => 'Carton data updated successfully',
        'carton' => $cartonDetails['success'] ? $cartonDetails['carton'] : null
    ]);
    
} catch (Exception $e) {
    http_response_code(400); // Bad Request
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
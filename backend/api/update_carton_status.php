<?php
/**
 * Update Carton Status API
 * 
 * This API endpoint updates the status of a carton by its ID.
 * It accepts POST requests with carton_id and status parameters.
 */

// Set headers for API response
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Cache-Control, X-Requested-With');
header('Access-Control-Max-Age: 86400'); // 24 hours

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Include database configuration
require_once '../config/database.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['error' => 'Only POST method is allowed']);
    exit;
}

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);

// If no JSON data, try regular POST
if (!$data) {
    $data = $_POST;
}

// Validate required parameters
if (!isset($data['carton_id']) || !isset($data['status'])) {
    http_response_code(400); // Bad Request
    echo json_encode(['error' => 'Missing required parameters: carton_id and status']);
    exit;
}

// Validate status value
$allowedStatuses = ['pending', 'entered', 'exited'];
if (!in_array($data['status'], $allowedStatuses)) {
    http_response_code(400); // Bad Request
    echo json_encode(['error' => 'Invalid status. Allowed values: ' . implode(', ', $allowedStatuses)]);
    exit;
}

try {
    // Get database connection
    $db = getDbConnection();
    
    // Update carton status
    $stmt = $db->prepare("UPDATE cartons SET status = ?, scan_timestamp = ?, updated_at = ? WHERE id = ?");
    $timestamp = date('Y-m-d H:i:s');
    
    $stmt->execute([$data['status'], $timestamp, $timestamp, $data['carton_id']]);
    
    // Check if carton exists
    if ($stmt->rowCount() === 0) {
        http_response_code(404); // Not Found
        echo json_encode(['error' => 'Carton not found with ID: ' . $data['carton_id']]);
        exit;
    }
    
    // Get updated carton data
    $stmt = $db->prepare("SELECT * FROM cartons WHERE id = ?");
    $stmt->execute([$data['carton_id']]);
    $carton = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Return success response
    echo json_encode([
        'success' => true,
        'message' => 'Carton status updated successfully',
        'carton' => $carton
    ]);
    
} catch (PDOException $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
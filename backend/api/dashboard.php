<?php
/**
 * Dashboard API Endpoint
 * 
 * This endpoint provides dashboard summary data and reports.
 */

// Set headers for API response
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Only GET method is allowed']);
    exit;
}

// Include required files
require_once '../config/database.php';
require_once '../includes/reports.php';

try {
    // Get database connection
    $pdo = getDbConnection();
    
    // Get dashboard summary data
    $summary = getDashboardSummary($pdo);
    
    if (!$summary['success']) {
        throw new Exception($summary['message']);
    }
    
    // Return success response
    echo json_encode($summary);
    
} catch (Exception $e) {
    http_response_code(400); // Bad Request
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
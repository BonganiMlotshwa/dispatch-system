<?php
/**
 * Search Shipments API Endpoint
 * 
 * This endpoint allows searching for shipments by PO number or FTM PO.
 */

// Set headers for API response
header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['GET']);

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Only GET method is allowed']);
    exit;
}

// Include required files
require_once '../config/database.php';

try {
    // Get database connection
    $pdo = getDbConnection();
    
    // Check if search term is provided
    if (!isset($_GET['search_term']) || empty($_GET['search_term'])) {
        throw new Exception('Search term is required');
    }
    
    $searchTerm = trim($_GET['search_term']);
    
    // Search for shipments by PO number or FTM PO
    $sql = "SELECT s.*, 
            (SELECT COUNT(*) FROM cartons WHERE shipment_id = s.id) as carton_count 
            FROM shipments s 
            WHERE s.file_name LIKE ? OR s.internal_po_number LIKE ? 
            ORDER BY import_date DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['%' . $searchTerm . '%', '%' . $searchTerm . '%']);
    $shipments = $stmt->fetchAll();
    
    // Return shipments
    echo json_encode([
        'success' => true,
        'shipments' => $shipments,
        'count' => count($shipments)
    ]);
    
} catch (Exception $e) {
    http_response_code(400); // Bad Request
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
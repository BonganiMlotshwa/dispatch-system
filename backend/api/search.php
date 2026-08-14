<?php
/**
 * Search API Endpoint
 * 
 * This endpoint allows searching for cartons by barcode or other criteria.
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
require_once '../includes/carton_scanner.php';

try {
    // Get database connection
    $pdo = getDbConnection();
    
    // Check if barcode search is requested
    if (isset($_GET['barcode'])) {
        $barcode = trim($_GET['barcode']);
        
        // Get carton details by barcode
        $result = getCartonDetails($barcode, $pdo);
        
        if (!$result['success']) {
            throw new Exception($result['message']);
        }
        
        echo json_encode($result);
    }
    // Advanced search with multiple criteria
    else {
        $sql = "SELECT c.*, s.internal_po_number, s.file_name 
               FROM cartons c 
               JOIN shipments s ON c.shipment_id = s.id 
               WHERE 1=1";
        $params = [];
        
        // Apply FTM PO filter
        if (isset($_GET['internal_po']) && !empty($_GET['internal_po'])) {
            $sql .= " AND s.internal_po_number LIKE ?";
            $params[] = '%' . $_GET['internal_po'] . '%';
        }
        
        // Apply status filter
        if (isset($_GET['status']) && in_array($_GET['status'], ['pending', 'entered', 'exited'])) {
            $sql .= " AND c.status = ?";
            $params[] = $_GET['status'];
        }
        
        // Apply size filter
        if (isset($_GET['size']) && !empty($_GET['size'])) {
            $sql .= " AND c.size = ?";
            $params[] = $_GET['size'];
        }
        
        // Apply QC number filter
        if (isset($_GET['qc_number']) && !empty($_GET['qc_number'])) {
            $sql .= " AND c.qc_number LIKE ?";
            $params[] = '%' . $_GET['qc_number'] . '%';
        }
        
        // Apply finishing number filter
        if (isset($_GET['finishing_number']) && !empty($_GET['finishing_number'])) {
            $sql .= " AND c.finishing_number LIKE ?";
            $params[] = '%' . $_GET['finishing_number'] . '%';
        }
        
        // Apply PO number filter
        if (isset($_GET['po_number']) && !empty($_GET['po_number'])) {
            $sql .= " AND c.po_number LIKE ?";
            $params[] = '%' . $_GET['po_number'] . '%';
        }
        
        // Apply limit
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
        $sql .= " LIMIT ?";
        $params[] = $limit;
        
        // Execute query
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $cartons = $stmt->fetchAll();
        
        echo json_encode([
            'success' => true,
            'cartons' => $cartons,
            'count' => count($cartons)
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(400); // Bad Request
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
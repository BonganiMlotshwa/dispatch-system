<?php
/**
 * Delete PO API Endpoint
 * 
 * Deletes a shipment and all associated cartons
 */

// Enable error logging
error_reporting(E_ALL);
ini_set('display_errors', 1);
error_log("=== DELETE PO REQUEST RECEIVED ===");

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

// Get database connection
$pdo = getDbConnection();
error_log("Database connection established");

try {
    // Get JSON input
    $rawInput = file_get_contents('php://input');
    error_log("Raw input: " . $rawInput);
    
    $input = json_decode($rawInput, true);
    error_log("Decoded input: " . print_r($input, true));
    
    if (!isset($input['id'])) {
        error_log("Missing id field");
        throw new Exception('Missing required field: id');
    }
    
    $id = intval($input['id']);
    error_log("Deleting PO with ID: " . $id);
    
    // Start transaction
    $pdo->beginTransaction();
    
    try {
        // Get shipment info before deleting
        $stmt = $pdo->prepare("SELECT internal_po_number FROM shipments WHERE id = ?");
        $stmt->execute([$id]);
        $shipment = $stmt->fetch(PDO::FETCH_ASSOC);
        
        error_log("Shipment found: " . print_r($shipment, true));
        
        if (!$shipment) {
            throw new Exception('PO not found');
        }
        
        // Delete associated cartons first (foreign key constraint)
        $deleteCartonsStmt = $pdo->prepare("DELETE FROM cartons WHERE shipment_id = ?");
        $deleteCartonsStmt->execute([$id]);
        $deletedCartons = $deleteCartonsStmt->rowCount();
        
        error_log("Deleted cartons: " . $deletedCartons);
        
        // Delete the shipment
        $deleteShipmentStmt = $pdo->prepare("DELETE FROM shipments WHERE id = ?");
        $deleteShipmentStmt->execute([$id]);
        
        if ($deleteShipmentStmt->rowCount() === 0) {
            throw new Exception('Failed to delete shipment');
        }
        
        error_log("Shipment deleted successfully");
        
        // Commit transaction
        $pdo->commit();
        
        $response = [
            'success' => true,
            'message' => 'PO deleted successfully',
            'data' => [
                'id' => $id,
                'internal_po_number' => $shipment['internal_po_number'],
                'deleted_cartons' => $deletedCartons
            ]
        ];
        
        error_log("Success response: " . json_encode($response));
        echo json_encode($response);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Transaction rolled back: " . $e->getMessage());
        throw $e;
    }
    
} catch (Exception $e) {
    error_log("Error in delete_po.php: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

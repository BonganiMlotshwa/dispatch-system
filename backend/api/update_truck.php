<?php
/**
 * Update Truck Shipment Info
 * Allows editing truck registration, driver name, date, week, and remarks
 */

header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['POST', 'PUT']);

require_once '../config/database.php';

try {
    $pdo = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (!isset($input['id']) || !isset($input['truck_reg']) || !isset($input['driver_name'])) {
        throw new Exception('ID, truck registration, and driver name are required');
    }
    
    $id = (int)$input['id'];
    $truckReg = trim($input['truck_reg']);
    $driverName = trim($input['driver_name']);
    $shipmentDate = isset($input['shipment_date']) ? $input['shipment_date'] : null;
    $shipmentWeek = isset($input['shipment_week']) ? trim($input['shipment_week']) : null;
    $remarks = isset($input['remarks']) ? trim($input['remarks']) : null;
    
    // Update truck shipment
    $stmt = $pdo->prepare("
        UPDATE truck_shipments 
        SET truck_reg = ?,
            driver_name = ?,
            shipment_date = ?,
            shipment_week = ?,
            remarks = ?,
            updated_at = NOW()
        WHERE id = ?
    ");
    
    $stmt->execute([
        $truckReg,
        $driverName,
        $shipmentDate,
        $shipmentWeek,
        $remarks,
        $id
    ]);
    
    if ($stmt->rowCount() === 0) {
        throw new Exception('Truck shipment not found or no changes made');
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Truck information updated successfully'
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

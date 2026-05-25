<?php
/**
 * Quick Truck Creation API
 * For creating truck shipments quickly during scanning
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
    
    // Validate required fields
    if (!isset($input['truck_reg']) || !isset($input['driver_name'])) {
        throw new Exception('Truck registration and driver name are required');
    }
    
    // Get shipment date and week (use defaults if not provided)
    $shipmentDate = isset($input['shipment_date']) ? $input['shipment_date'] : date('Y-m-d');
    $shipmentWeek = isset($input['shipment_week']) ? $input['shipment_week'] : null;
    
    $pdo->beginTransaction();
    
    $hasLoadingStatus = (bool)$pdo->query("SHOW COLUMNS FROM truck_shipments LIKE 'loading_status'")->fetch();
    $cols = '(shipment_date, shipment_week, truck_reg, driver_name';
    $vals = 'VALUES (?, ?, ?, ?';
    $params = [$shipmentDate, $shipmentWeek, $input['truck_reg'], $input['driver_name']];
    if ($hasLoadingStatus) {
        $cols .= ', loading_status';
        $vals .= ", 'open'";
    }
    $cols .= ')';
    $vals .= ')';

    $stmt = $pdo->prepare("INSERT INTO truck_shipments {$cols} {$vals}");
    $stmt->execute($params);
    
    $truckShipmentId = $pdo->lastInsertId();
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Truck created successfully',
        'truck' => [
            'id' => $truckShipmentId,
            'truck_reg' => $input['truck_reg'],
            'driver_name' => $input['driver_name'],
            'shipment_date' => $shipmentDate,
            'shipment_week' => $shipmentWeek
        ]
    ]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

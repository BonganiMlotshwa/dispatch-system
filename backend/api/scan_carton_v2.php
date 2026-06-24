<?php
/**
 * Enhanced Carton Scanning API with Audit Trail
 * Supports scan count display and user tracking
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';
require_once '../includes/carton_timestamps.php';
require_once '../includes/sync_shipment_warehouse_status.php';

try {
    $pdo = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (!isset($input['barcode']) || !isset($input['action'])) {
        throw new Exception('Barcode and action are required');
    }
    
    $barcode = trim($input['barcode']);
    $action = $input['action']; // 'entry' or 'exit'
    $scannedBy = $input['scanned_by'] ?? 'System';
    $notes = $input['notes'] ?? null;
    $truckShipmentId = isset($input['truck_shipment_id']) ? (int)$input['truck_shipment_id'] : null;
    
    // Validate action
    if (!in_array($action, ['entry', 'exit'])) {
        throw new Exception('Invalid action. Must be "entry" or "exit"');
    }
    
    // Validate truck shipment for exit scans
    if ($action === 'exit') {
        if (!$truckShipmentId) {
            throw new Exception('Truck shipment must be selected for exit scans');
        }
        
        // Verify truck shipment exists
        $stmt = $pdo->prepare("SELECT id, truck_reg, driver_name FROM truck_shipments WHERE id = ?");
        $stmt->execute([$truckShipmentId]);
        $truckShipment = $stmt->fetch();
        
        if (!$truckShipment) {
            throw new Exception('Invalid truck shipment');
        }
    }
    
    $pdo->beginTransaction();
    
    // Find carton
    $stmt = $pdo->prepare("SELECT * FROM cartons WHERE barcode_2d = ?");
    $stmt->execute([$barcode]);
    $carton = $stmt->fetch();
    
    if (!$carton) {
        throw new Exception('Carton not found');
    }
    
    $previousStatus = $carton['status'];
    $newStatus = ($action === 'entry') ? 'entered' : 'exited';
    
    // Update carton while keeping separate scan-in and scan-out timestamps.
    $hasTsCols = cartonTimestampColumnsExist($pdo);
    $tsUpdate = buildCartonStatusTimestampUpdate($newStatus, $previousStatus, $hasTsCols);
    $stmt = $pdo->prepare("
        UPDATE cartons 
        SET {$tsUpdate['sql']},
            scanned_by = ?,
            scan_type = ?,
            truck_shipment_id = ?
        WHERE id = ?
    ");
    $stmt->execute(array_merge($tsUpdate['params'], [$scannedBy, $action, $truckShipmentId, $carton['id']]));
    
    // Log to audit trail
    $stmt = $pdo->prepare("
        INSERT INTO scan_audit_log 
        (carton_id, scan_type, scan_timestamp, scanned_by, previous_status, new_status, truck_shipment_id, notes)
        VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $carton['id'],
        $action,
        $scannedBy,
        $previousStatus,
        $newStatus,
        $truckShipmentId,
        $notes
    ]);
    
    // Get scan count for this carton
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as scan_count 
        FROM scan_audit_log 
        WHERE carton_id = ?
    ");
    $stmt->execute([$carton['id']]);
    $scanCount = $stmt->fetch()['scan_count'];
    
    // Get shipment info
    $stmt = $pdo->prepare("SELECT * FROM shipments WHERE id = ?");
    $stmt->execute([$carton['shipment_id']]);
    $shipment = $stmt->fetch();

    if (!empty($carton['shipment_id'])) {
        syncShipmentWarehouseStatus($pdo, (int)$carton['shipment_id']);
    }
    
    $pdo->commit();
    
    $response = [
        'success' => true,
        'message' => ucfirst($action) . ' scan successful',
        'carton' => [
            'id' => $carton['id'],
            'barcode' => $carton['barcode_2d'],
            'po_number' => $carton['po_number'],
            'size' => $carton['size'],
            'units' => $carton['units'],
            'previous_status' => $previousStatus,
            'new_status' => $newStatus,
            'scan_count' => $scanCount,
            'scanned_by' => $scannedBy,
            'scan_timestamp' => date('Y-m-d H:i:s')
        ],
        'shipment' => [
            'internal_po_number' => $shipment['internal_po_number'],
            'customer' => $shipment['customer']
        ]
    ];
    
    // Add truck info for exit scans
    if ($action === 'exit' && isset($truckShipment)) {
        $response['truck'] = [
            'id' => $truckShipment['id'],
            'truck_reg' => $truckShipment['truck_reg'],
            'driver_name' => $truckShipment['driver_name']
        ];
    }
    
    echo json_encode($response);
    
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

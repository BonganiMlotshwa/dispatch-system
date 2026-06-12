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
require_once '../includes/admin_auth.php';
require_once '../includes/carton_timestamps.php';
require_once '../includes/carton_status_helpers.php';
require_once '../includes/sync_shipment_warehouse_status.php';
require_once '../includes/truck_manual_assign.php';

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

$data['status'] = normalizeCartonScanStatus($data['status'] ?? '');

// Validate status value
$allowedStatuses = ['pending', 'entered', 'exited'];
if (!in_array($data['status'], $allowedStatuses, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid status. Allowed: Pending, In Warehouse (entered), Shipped (exited)']);
    exit;
}

$truckReg = trim((string)($data['truck_reg'] ?? ''));
$driverName = trim((string)($data['driver_name'] ?? ''));

// Manual status changes require admin code unless shipping details are provided for a ship action.
if ($data['status'] === 'exited') {
    if ($truckReg === '' || $driverName === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Truck registration and driver name are required to mark a carton as shipped.']);
        exit;
    }
} else {
    requireAdminCode($data);
}

try {
    // Get database connection
    $db = getDbConnection();
    
    $stmt = $db->prepare("SELECT status FROM cartons WHERE id = ?");
    $stmt->execute([$data['carton_id']]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$existing) {
        http_response_code(404);
        echo json_encode(['error' => 'Carton not found with ID: ' . $data['carton_id']]);
        exit;
    }

    if ($data['status'] === 'exited') {
        assertCartonsAllowDirectShip($db, [(int)$data['carton_id']]);
    }

    if ($data['status'] === 'exited' && $existing['status'] !== 'entered') {
        http_response_code(400);
        echo json_encode([
            'error' => 'Only cartons that are in warehouse can be marked as shipped.'
        ]);
        exit;
    }

    $hasTsCols = cartonTimestampColumnsExist($db);
    $tsUpdate = buildCartonStatusTimestampUpdate($data['status'], $existing['status'], $hasTsCols);
    $stmt = $db->prepare("UPDATE cartons SET {$tsUpdate['sql']} WHERE id = ?");
    $stmt->execute(array_merge($tsUpdate['params'], [$data['carton_id']]));
    
    // TODO: Store truck_reg and driver_name in truck_shipments table
    // For now, we accept these parameters but don't store them
    // Future enhancement: Create truck shipment entry with these details
    
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
    if (!empty($carton['shipment_id'])) {
        syncShipmentWarehouseStatus($db, (int)$carton['shipment_id']);
    }
    
    // Return success response
    echo json_encode([
        'success' => true,
        'message' => cartonScanSuccessMessage($carton['status']),
        'carton' => array_merge($carton, ['status_label' => cartonStatusLabel($carton['status'])])
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
} catch (PDOException $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}

<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST and PUT methods are allowed']);
    exit;
}

require_once '../config/database.php';
require_once '../includes/po_helpers.php';

try {
    $pdo = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Handle UPDATE (PUT request)
    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        if (!isset($input['shipment_id'])) {
            throw new Exception('Shipment ID is required for update');
        }
        
        $shipmentId = (int)$input['shipment_id'];
        
        // Verify shipment exists and is manual entry
        $stmt = $pdo->prepare("SELECT * FROM shipments WHERE id = ? AND entry_type = 'manual'");
        $stmt->execute([$shipmentId]);
        $shipment = $stmt->fetch();
        
        if (!$shipment) {
            throw new Exception('Manual entry shipment not found');
        }
        
        $pdo->beginTransaction();
        
        // Update shipment details if provided
        if (isset($input['style']) || isset($input['color']) || isset($input['order_qty'])) {
            $updateFields = [];
            $updateValues = [];
            
            if (isset($input['style'])) {
                $updateFields[] = 'style = ?';
                $updateValues[] = $input['style'];
            }
            if (isset($input['color'])) {
                $updateFields[] = 'color = ?';
                $updateValues[] = $input['color'];
            }
            if (isset($input['order_qty'])) {
                $updateFields[] = 'order_qty = ?';
                $updateValues[] = $input['order_qty'];
            }
            
            if (!empty($updateFields)) {
                $updateValues[] = $shipmentId;
                $sql = "UPDATE shipments SET " . implode(', ', $updateFields) . " WHERE id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($updateValues);
            }
        }
        
        // Add more cartons if requested
        if (isset($input['add_cartons']) && $input['add_cartons'] > 0) {
            // Get current max carton number
            $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM cartons WHERE shipment_id = ?");
            $stmt->execute([$shipmentId]);
            $currentCount = $stmt->fetch()['count'];
            
            $addCartons = (int)$input['add_cartons'];
            $unitsPerCarton = isset($input['units_per_carton']) ? (int)$input['units_per_carton'] : 1;
            
            $stmt = $pdo->prepare("INSERT INTO cartons 
                (shipment_id, po_number, barcode_2d, size, units, status, scan_timestamp) 
                VALUES (?, ?, ?, ?, ?, ?, ?)");
            
            $stmtPo = $pdo->prepare("SELECT po_number FROM cartons WHERE shipment_id = ? LIMIT 1");
            $stmtPo->execute([$shipmentId]);
            $existingPo = $stmtPo->fetchColumn();
            $customerPoFull = $existingPo ?: buildCustomerPoNumber($shipment['customer'], '');
            $customerPoSuffix = preg_replace('/^[A-Z]+-/i', '', $customerPoFull);

            for ($i = 1; $i <= $addCartons; $i++) {
                $cartonNum = $currentCount + $i;
                $barcode = $shipment['customer'] . '-' . $customerPoSuffix . '-' . str_pad($cartonNum, 4, '0', STR_PAD_LEFT);
                
                $status = isset($input['mark_as_received']) && $input['mark_as_received'] ? 'entered' : 'pending';
                $timestamp = $status === 'entered' ? date('Y-m-d H:i:s') : null;
                
                $stmt->execute([
                    $shipmentId,
                    $customerPoFull,
                    $barcode,
                    $input['size'] ?? 'N/A',
                    $unitsPerCarton,
                    $status,
                    $timestamp
                ]);
            }
        }
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Manual entry updated successfully',
            'shipment_id' => $shipmentId
        ]);
        exit;
    }
    
    // Handle CREATE (POST request)
    // Validate required fields
    $required = ['customer', 'order_no', 'customer_po', 'style', 'color', 'order_qty', 'cartons_expected', 'units_expected'];
    foreach ($required as $field) {
        if (!isset($input[$field]) || $input[$field] === '') {
            throw new Exception("Field '$field' is required");
        }
    }
    
    $pdo->beginTransaction();
    
    $internalPO = normalizeOrderNumber($input['order_no']);
    $customerPoFull = buildCustomerPoNumber($input['customer'], $input['customer_po']);
    $customerPoSuffix = preg_replace('/^[A-Z]+-/i', '', $customerPoFull);
    
    // Check if this order number already exists
    $checkStmt = $pdo->prepare("SELECT id FROM shipments WHERE internal_po_number = ?");
    $checkStmt->execute([$internalPO]);
    if ($checkStmt->fetch()) {
        throw new Exception("Order number '$internalPO' already exists. Please use a different order number.");
    }
    
    // Create shipment record
    $stmt = $pdo->prepare("INSERT INTO shipments 
        (internal_po_number, customer, style, color, order_qty, file_name, entry_type, import_date) 
        VALUES (?, ?, ?, ?, ?, ?, 'manual', NOW())");
    
    $fileName = $input['customer'] . '-' . $customerPoSuffix . '-' . date('Ymd-His');
    $stmt->execute([
        $internalPO,
        $input['customer'],
        $input['style'],
        $input['color'],
        $input['order_qty'],
        $fileName
    ]);
    
    $shipmentId = $pdo->lastInsertId();
    
    // Create carton records for EXPECTED cartons
    $cartonsExpected = (int)$input['cartons_expected'];
    $unitsExpected = (int)$input['units_expected'];
    $unitsPerCarton = floor($unitsExpected / $cartonsExpected);
    $remainingUnits = $unitsExpected % $cartonsExpected;
    
    $stmt = $pdo->prepare("INSERT INTO cartons 
        (shipment_id, po_number, barcode_2d, size, units, status, scan_timestamp) 
        VALUES (?, ?, ?, ?, ?, ?, ?)");
    
    for ($i = 1; $i <= $cartonsExpected; $i++) {
        $barcode = $input['customer'] . '-' . $customerPoSuffix . '-' . str_pad($i, 4, '0', STR_PAD_LEFT);
        $units = $unitsPerCarton + ($i <= $remainingUnits ? 1 : 0);
        
        // Determine status and timestamp based on whether cartons were received
        $cartonsReceived = isset($input['cartons_received']) ? (int)$input['cartons_received'] : 0;
        
        if ($cartonsReceived > 0 && $i <= $cartonsReceived) {
            $status = 'entered';
            $timestamp = date('Y-m-d H:i:s');
        } else {
            $status = 'pending';
            $timestamp = null;
        }
        
        $stmt->execute([
            $shipmentId,
            $customerPoFull,
            $barcode,
            $input['size'] ?? 'N/A',
            $units,
            $status,
            $timestamp
        ]);
    }
    
    $pdo->commit();
    
    $cartonsReceived = isset($input['cartons_received']) ? (int)$input['cartons_received'] : 0;
    $cartonsPending = $cartonsExpected - $cartonsReceived;
    
    echo json_encode([
        'success' => true,
        'message' => 'Manual entry created successfully',
        'shipment_id' => $shipmentId,
        'cartons_expected' => $cartonsExpected,
        'cartons_received' => $cartonsReceived,
        'cartons_pending' => $cartonsPending
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

<?php
/**
 * Carton Scanner Utility
 * 
 * This file contains functions for handling carton scanning operations.
 */

require_once __DIR__ . '/po_helpers.php';
require_once __DIR__ . '/carton_timestamps.php';
require_once __DIR__ . '/carton_status_helpers.php';
require_once __DIR__ . '/sync_shipment_warehouse_status.php';

/**
 * Process a carton scan
 * 
 * @param string $barcode The scanned barcode (BarCode2D)
 * @param string $action The scan action ('enter' or 'exit')
 * @param PDO $pdo Database connection
 * @param string|null $expectedPo Expected PO number for validation
 * @param int|null $truckShipmentId Truck shipment ID for exit scans
 * @param string|null $notes Optional notes
 * @return array Result of the scan operation
 */
function processCartonScan($barcode, $action, $pdo, $expectedPo = null, $truckShipmentId = null, $notes = null) {
    try {
        // Start timing for performance monitoring
        $startTime = microtime(true);
        
        // Validate action
        if (!in_array($action, ['enter', 'exit'])) {
            return [
                'success' => false,
                'message' => 'Invalid action. Must be "enter" or "exit"'
            ];
        }
        
        // Optimize query - only select needed fields
        $stmt = $pdo->prepare("SELECT c.id, c.barcode_2d, c.po_number, c.size, c.units, c.item, c.status, c.shipment_id, s.internal_po_number 
                              FROM cartons c
                              JOIN shipments s ON c.shipment_id = s.id 
                              WHERE c.barcode_2d = ? LIMIT 1");
        $stmt->execute([$barcode]);
        $carton = $stmt->fetch();
        
        if (!$carton) {
            return [
                'success' => false,
                'message' => 'Carton not found. Barcode: ' . $barcode,
                'error_code' => 'NOT_FOUND'
            ];
        }
        
        // If an expected PO was provided, verify carton belongs to that PO (match either po_number or internal PO)
        if ($expectedPo !== null && $expectedPo !== '') {
            $poMatches = cartonMatchesExpectedPo($carton, $expectedPo);
            if (!$poMatches) {
                return [
                    'success' => false,
                    'message' => 'Scanned carton does not belong to the selected PO.',
                    'error_code' => 'WRONG_PO',
                    'carton_po' => $carton['po_number'],
                    'expected_po' => $expectedPo
                ];
            }
        }

        // Determine new status based on action
        $newStatus = ($action === 'enter') ? 'entered' : 'exited';
        
        // Check if carton has already exited - once exited, never scannable again
        if ($carton['status'] === 'exited') {
            return [
                'success' => false,
                'message' => 'This carton has already exited the warehouse and cannot be scanned again.',
                'error_code' => 'ALREADY_EXITED'
            ];
        }
        
        // Check for duplicate scans - if the carton already has the status we're trying to set
        if ($carton['status'] === $newStatus) {
            return [
                'success' => false,
                'message' => 'This carton has already been ' . $newStatus . '. Duplicate scan detected.',
                'error_code' => 'DUPLICATE'
            ];
        }
        
        // Check for invalid state transitions
        if ($action === 'exit' && $carton['status'] !== 'entered') {
            return [
                'success' => false,
                'message' => 'Cannot exit a carton that has not been entered',
                'error_code' => 'INVALID_TRANSITION'
            ];
        }
        
        $hasTsCols = cartonTimestampColumnsExist($pdo);
        $tsUpdate = buildCartonStatusTimestampUpdate($newStatus, $carton['status'], $hasTsCols);

        // Optimistic locking: include the expected current status in the WHERE clause so
        // that if a concurrent scanner already changed this carton between our SELECT and
        // this UPDATE, rowCount() returns 0 instead of silently double-counting.
        if ($action === 'exit' && $truckShipmentId) {
            $stmt = $pdo->prepare("UPDATE cartons SET {$tsUpdate['sql']}, truck_shipment_id = ? WHERE id = ? AND status = ?");
            $stmt->execute(array_merge($tsUpdate['params'], [$truckShipmentId, $carton['id'], $carton['status']]));
        } else {
            $stmt = $pdo->prepare("UPDATE cartons SET {$tsUpdate['sql']} WHERE id = ? AND status = ?");
            $stmt->execute(array_merge($tsUpdate['params'], [$carton['id'], $carton['status']]));
        }

        if ($stmt->rowCount() === 0) {
            // Another scanner changed this carton's status between our read and this write.
            $freshStmt = $pdo->prepare('SELECT status FROM cartons WHERE id = ? LIMIT 1');
            $freshStmt->execute([$carton['id']]);
            $freshRow = $freshStmt->fetch(PDO::FETCH_ASSOC);
            $currentStatus = $freshRow['status'] ?? 'unknown';

            if ($currentStatus === $newStatus) {
                return [
                    'success' => false,
                    'message' => 'Another scanner just scanned this carton.',
                    'error_code' => 'DUPLICATE',
                ];
            }
            return [
                'success' => false,
                'message' => 'Carton status changed by another scanner — please try again.',
                'error_code' => 'RACE_CONDITION',
            ];
        }

        if (!empty($carton['shipment_id'])) {
            syncShipmentWarehouseStatus($pdo, (int)$carton['shipment_id']);
        }

        // Calculate processing time
        $processingTime = round((microtime(true) - $startTime) * 1000, 2); // in milliseconds
        
        // Return minimal data needed for UI to improve response time
        return [
            'success' => true,
            'message' => cartonScanSuccessMessage($newStatus),
            'processing_time_ms' => $processingTime,
            'carton' => [
                'id' => $carton['id'],
                'barcode' => $carton['barcode_2d'],
                'po_number' => $carton['po_number'],
                'internal_po' => $carton['internal_po_number'],
                'size' => $carton['size'],
                'units' => $carton['units'],
                'item' => $carton['item'],
                'status' => $newStatus,
                'status_label' => cartonStatusLabel($newStatus),
                'timestamp' => date('Y-m-d H:i:s')
            ]
        ];
        
    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

/**
 * Update carton manual data (QC number, Finishing number, Notes)
 * 
 * @param string $barcode The carton barcode
 * @param array $data Associative array of data to update
 * @param PDO $pdo Database connection
 * @return array Result of the update operation
 */
function updateCartonData($barcode, $data, $pdo) {
    try {
        // Find the carton in the database
        $stmt = $pdo->prepare("SELECT id FROM cartons WHERE barcode_2d = ?");
        $stmt->execute([$barcode]);
        $carton = $stmt->fetch();
        
        if (!$carton) {
            return [
                'success' => false,
                'message' => 'Carton not found. Barcode: ' . $barcode
            ];
        }
        
        // Build update query based on provided data
        $updateFields = [];
        $params = [];
        
        // Check which fields to update
        if (isset($data['qc_number'])) {
            $updateFields[] = 'qc_number = ?';
            $params[] = $data['qc_number'];
        }
        
        if (isset($data['finishing_number'])) {
            $updateFields[] = 'finishing_number = ?';
            $params[] = $data['finishing_number'];
        }
        
        if (isset($data['notes'])) {
            $updateFields[] = 'notes = ?';
            $params[] = $data['notes'];
        }
        
        if (empty($updateFields)) {
            return [
                'success' => false,
                'message' => 'No data provided for update'
            ];
        }
        
        // Add carton ID to params
        $params[] = $carton['id'];
        
        // Execute update
        $sql = "UPDATE cartons SET " . implode(', ', $updateFields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        return [
            'success' => true,
            'message' => 'Carton data updated successfully',
            'carton_id' => $carton['id']
        ];
        
    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

/**
 * Get carton details by barcode
 * 
 * @param string $barcode The carton barcode
 * @param PDO $pdo Database connection
 * @return array Carton details or error message
 */
function getCartonDetails($barcode, $pdo) {
    try {
        $stmt = $pdo->prepare("SELECT c.*, s.internal_po_number, s.file_name 
                              FROM cartons c 
                              JOIN shipments s ON c.shipment_id = s.id 
                              WHERE c.barcode_2d = ?");
        $stmt->execute([$barcode]);
        $carton = $stmt->fetch();
        
        if (!$carton) {
            return [
                'success' => false,
                'message' => 'Carton not found. Barcode: ' . $barcode
            ];
        }
        
        return [
            'success' => true,
            'carton' => $carton
        ];
        
    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}
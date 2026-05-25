<?php
/**
 * Bulk Update Carton Status API
 * 
 * This API endpoint updates the status of multiple cartons in a single request.
 * It accepts POST requests with an array of carton updates.
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
require_once '../includes/carton_timestamps.php';
require_once '../includes/carton_status_helpers.php';
require_once '../includes/sync_shipment_warehouse_status.php';

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
if (!isset($data['updates']) || !is_array($data['updates'])) {
    http_response_code(400); // Bad Request
    echo json_encode(['error' => 'Missing required parameter: updates (array)']);
    exit;
}

// Validate status values
$allowedStatuses = ['pending', 'entered', 'exited'];

try {
    // Get database connection
    $db = getDbConnection();
    
    // Start transaction for atomic updates
    $db->beginTransaction();
    
    $successCount = 0;
    $errorCount = 0;
    $errors = [];
    $updatedCartons = [];
    
    $timestamp = date('Y-m-d H:i:s');
    
    // Group updates by status for batch processing
    $updatesByStatus = [];
    foreach ($data['updates'] as $update) {
        // Validate each update
        if (!isset($update['carton_id']) || !isset($update['status'])) {
            $errorCount++;
            $errors[] = "Missing carton_id or status in update";
            continue;
        }
        
        $status = normalizeCartonScanStatus($update['status']);
        if (!in_array($status, $allowedStatuses, true)) {
            $errorCount++;
            $errors[] = "Invalid status '{$update['status']}' for carton {$update['carton_id']}";
            continue;
        }
        if (!isset($updatesByStatus[$status])) {
            $updatesByStatus[$status] = [];
        }
        $updatesByStatus[$status][] = (int)$update['carton_id'];
    }
    
    // Process each status group with a single query
    foreach ($updatesByStatus as $status => $cartonIds) {
        if (empty($cartonIds)) continue;
        
        try {
            // Create placeholders for IN clause
            $placeholders = str_repeat('?,', count($cartonIds) - 1) . '?';
            
            $hasTsCols = cartonTimestampColumnsExist($db);
            if ($hasTsCols && $status === 'entered') {
                $sql = "UPDATE cartons SET status = ?, scan_timestamp = ?, entry_timestamp = COALESCE(entry_timestamp, ?), updated_at = ? WHERE id IN ($placeholders)";
                $params = array_merge([$status, $timestamp, $timestamp, $timestamp], $cartonIds);
            } elseif ($hasTsCols && $status === 'exited') {
                $sql = "UPDATE cartons SET status = ?, scan_timestamp = ?, exit_timestamp = ?, updated_at = ? WHERE id IN ($placeholders)";
                $params = array_merge([$status, $timestamp, $timestamp, $timestamp], $cartonIds);
            } else {
                $sql = "UPDATE cartons SET status = ?, scan_timestamp = ?, updated_at = ? WHERE id IN ($placeholders)";
                $params = array_merge([$status, $timestamp, $timestamp], $cartonIds);
            }
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            
            $rowsAffected = $stmt->rowCount();
            $successCount += $rowsAffected;
            $updatedCartons = array_merge($updatedCartons, array_slice($cartonIds, 0, $rowsAffected));
            
            // Check for cartons that weren't found
            $notFoundCount = count($cartonIds) - $rowsAffected;
            if ($notFoundCount > 0) {
                $errorCount += $notFoundCount;
                $errors[] = "$notFoundCount carton(s) not found for status '$status'";
            }
            
        } catch (PDOException $e) {
            $errorCount += count($cartonIds);
            $errors[] = "Database error for status '$status': " . $e->getMessage();
        }
    }
    
    // Commit transaction if we have any successes
    if ($successCount > 0) {
        $db->commit();
        if (!empty($updatedCartons)) {
            $ph = str_repeat('?,', count($updatedCartons) - 1) . '?';
            $sidStmt = $db->prepare("SELECT DISTINCT shipment_id FROM cartons WHERE id IN ($ph)");
            $sidStmt->execute($updatedCartons);
            while ($sidRow = $sidStmt->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($sidRow['shipment_id'])) {
                    syncShipmentWarehouseStatus($db, (int)$sidRow['shipment_id']);
                }
            }
        }
    } else {
        $db->rollback();
    }
    
    // Return response
    $response = [
        'success' => $successCount > 0,
        'message' => "Bulk update completed: {$successCount} successful, {$errorCount} failed",
        'success_count' => $successCount,
        'error_count' => $errorCount,
        'updated_cartons' => $updatedCartons
    ];
    
    if (!empty($errors)) {
        $response['errors'] = $errors;
    }
    
    echo json_encode($response);
    
} catch (PDOException $e) {
    // Rollback transaction on error
    if ($db->inTransaction()) {
        $db->rollback();
    }
    
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500); // Internal Server Error
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
}
?>
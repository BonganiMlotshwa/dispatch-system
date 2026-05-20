<?php
/**
 * Active Trucks API
 * Returns truck shipments available for loading today
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';

try {
    $pdo = getDbConnection();
    
    // Get truck shipments for today
    $stmt = $pdo->query("
        SELECT 
            ts.id,
            ts.truck_reg,
            ts.driver_name,
            ts.shipment_date,
            ts.shipment_week,
            ts.remarks,
            COUNT(c.id) as cartons_loaded,
            COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as units_loaded
        FROM truck_shipments ts
        LEFT JOIN cartons c ON c.truck_shipment_id = ts.id AND c.status = 'exited'
        WHERE DATE(ts.shipment_date) = CURDATE()
        GROUP BY ts.id
        ORDER BY ts.created_at DESC
    ");
    
    $trucks = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'trucks' => $trucks,
        'count' => count($trucks)
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

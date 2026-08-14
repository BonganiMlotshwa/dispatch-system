<?php
/**
 * Active Trucks API
 * Returns truck shipments available for loading today
 */

header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['GET']);

require_once '../config/database.php';

try {
    $pdo = getDbConnection();
    
    $hasLoadingStatus = (bool)$pdo->query("SHOW COLUMNS FROM truck_shipments LIKE 'loading_status'")->fetch();

    $statusFilter = $hasLoadingStatus ? "AND ts.loading_status = 'open'" : '';

    // Open trucks still being loaded (any date — supports parked / multi-day loads)
    $stmt = $pdo->query("
        SELECT 
            ts.id,
            ts.truck_reg,
            ts.driver_name,
            ts.shipment_date,
            ts.shipment_week,
            ts.remarks,
            ts.updated_at,
            COUNT(c.id) as cartons_loaded,
            COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as units_loaded
        FROM truck_shipments ts
        LEFT JOIN cartons c ON c.truck_shipment_id = ts.id AND c.status = 'exited'
        WHERE 1=1 {$statusFilter}
        GROUP BY ts.id, ts.truck_reg, ts.driver_name, ts.shipment_date, ts.shipment_week, ts.remarks, ts.updated_at
        ORDER BY ts.updated_at DESC
        LIMIT 50
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

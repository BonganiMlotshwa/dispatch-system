<?php
/**
 * Truck Summary API
 * Get summary of all trucks with carton and unit counts
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
    
    // Get filter parameters
    $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
    $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;
    $week = isset($_GET['week']) ? $_GET['week'] : null;
    $truckReg = isset($_GET['truck_reg']) ? $_GET['truck_reg'] : null;
    
    // Build WHERE clause
    $whereConditions = [];
    $params = [];
    
    if ($startDate && $endDate) {
        $whereConditions[] = "ts.shipment_date BETWEEN ? AND ?";
        $params[] = $startDate;
        $params[] = $endDate;
    } elseif ($startDate) {
        $whereConditions[] = "ts.shipment_date >= ?";
        $params[] = $startDate;
    } elseif ($endDate) {
        $whereConditions[] = "ts.shipment_date <= ?";
        $params[] = $endDate;
    }
    
    if ($week) {
        $whereConditions[] = "ts.shipment_week = ?";
        $params[] = $week;
    }
    
    if ($truckReg) {
        $whereConditions[] = "ts.truck_reg LIKE ?";
        $params[] = "%{$truckReg}%";
    }
    
    $whereClause = count($whereConditions) > 0 ? "WHERE " . implode(" AND ", $whereConditions) : "";
    
    // Get truck shipments with carton counts
    $sql = "
        SELECT 
            ts.id,
            ts.shipment_date,
            ts.shipment_week,
            ts.truck_reg,
            ts.driver_name,
            ts.remarks,
            ts.created_at,
            COUNT(DISTINCT c.id) as total_cartons,
            COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as total_units,
            COUNT(DISTINCT c.shipment_id) as total_pos,
            GROUP_CONCAT(DISTINCT s.customer ORDER BY s.customer SEPARATOR ', ') as customers
        FROM truck_shipments ts
        LEFT JOIN cartons c ON c.truck_shipment_id = ts.id
        LEFT JOIN shipments s ON c.shipment_id = s.id
        {$whereClause}
        GROUP BY ts.id, ts.shipment_date, ts.shipment_week, ts.truck_reg, ts.driver_name, ts.remarks, ts.created_at
        ORDER BY ts.shipment_date DESC, ts.created_at DESC
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $trucks = $stmt->fetchAll();
    
    // Get summary statistics
    $totalTrucks = count($trucks);
    $totalCartons = array_sum(array_column($trucks, 'total_cartons'));
    $totalUnits = array_sum(array_column($trucks, 'total_units'));
    
    // Get available weeks for filter dropdown
    $stmt = $pdo->query("
        SELECT DISTINCT shipment_week 
        FROM truck_shipments 
        WHERE shipment_week IS NOT NULL 
        ORDER BY shipment_week DESC
    ");
    $availableWeeks = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    echo json_encode([
        'success' => true,
        'trucks' => $trucks,
        'summary' => [
            'total_trucks' => $totalTrucks,
            'total_cartons' => $totalCartons,
            'total_units' => $totalUnits
        ],
        'available_weeks' => $availableWeeks
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

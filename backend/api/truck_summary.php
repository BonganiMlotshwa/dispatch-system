<?php
/**
 * Truck Summary API
 * Get summary of all trucks with carton and unit counts
 */

header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['GET']);
require_once '../includes/auth.php';
auth_require_user();

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
    
    // Check whether the legacy items table exists
    $legacyTableExists = (bool)$pdo->query("SHOW TABLES LIKE 'truck_shipment_legacy_items'")->fetch();

    $legacyCartonsSub = $legacyTableExists
        ? "COALESCE((SELECT SUM(tli.cartons_shipped) FROM truck_shipment_legacy_items tli WHERE tli.truck_shipment_id = ts.id), 0)"
        : "0";
    $legacyUnitsSub = $legacyTableExists
        ? "COALESCE((SELECT SUM(tli.units_shipped) FROM truck_shipment_legacy_items tli WHERE tli.truck_shipment_id = ts.id), 0)"
        : "0";
    $legacyPosSub = $legacyTableExists
        ? "COALESCE((SELECT COUNT(*) FROM truck_shipment_legacy_items tli WHERE tli.truck_shipment_id = ts.id), 0)"
        : "0";
    $legacyCustomersSub = $legacyTableExists
        ? "COALESCE((SELECT GROUP_CONCAT(DISTINCT lg.customer ORDER BY lg.customer SEPARATOR ', ') FROM truck_shipment_legacy_items tli INNER JOIN legacy_warehouse_goods lg ON lg.id = tli.legacy_goods_id WHERE tli.truck_shipment_id = ts.id), '')"
        : "''";

    // Get truck shipments with carton counts — system + previous year combined
    $sql = "
        SELECT
            ts.id,
            ts.shipment_date,
            ts.shipment_week,
            ts.truck_reg,
            ts.driver_name,
            ts.remarks,
            ts.created_at,
            COUNT(DISTINCT c.id) as system_cartons,
            COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as system_units,
            COUNT(DISTINCT c.shipment_id) as system_pos,
            {$legacyCartonsSub} as legacy_cartons,
            {$legacyUnitsSub} as legacy_units,
            {$legacyPosSub} as legacy_pos,
            GROUP_CONCAT(DISTINCT s.customer ORDER BY s.customer SEPARATOR ', ') as customers,
            {$legacyCustomersSub} as legacy_customers
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

    // Combine system + previous year totals per truck; normalise legacy remarks label
    foreach ($trucks as &$truck) {
        $truck['total_cartons'] = (int)$truck['system_cartons'] + (int)$truck['legacy_cartons'];
        $truck['total_units']   = (int)$truck['system_units']   + (int)$truck['legacy_units'];
        $truck['total_pos']     = (int)$truck['system_pos']     + (int)$truck['legacy_pos'];
        $truck['remarks']       = str_replace('Legacy: ', 'Prev. Year: ', $truck['remarks'] ?? '');
        $sysC = $truck['customers'] ? array_filter(explode(', ', $truck['customers'])) : [];
        $legC = $truck['legacy_customers'] ? array_filter(explode(', ', $truck['legacy_customers'])) : [];
        $truck['customers'] = implode(', ', array_unique(array_merge($sysC, $legC))) ?: '-';
    }
    unset($truck);

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

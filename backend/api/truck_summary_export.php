<?php
/**
 * Truck Summary Export
 * Export all trucks with summary information
 */

require_once '../config/database.php';
require_once '../includes/csv_export.php';

try {
    $pdo = getDbConnection();
    
    $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
    $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;
    $week = isset($_GET['week']) ? $_GET['week'] : null;
    
    $whereConditions = [];
    $params = [];
    
    if ($startDate && $endDate) {
        $whereConditions[] = "ts.shipment_date BETWEEN ? AND ?";
        $params[] = $startDate;
        $params[] = $endDate;
    }
    
    if ($week) {
        $whereConditions[] = "ts.shipment_week = ?";
        $params[] = $week;
    }
    
    $whereClause = count($whereConditions) > 0 ? "WHERE " . implode(" AND ", $whereConditions) : "";
    
    $sql = "
        SELECT 
            ts.shipment_date,
            ts.shipment_week,
            ts.truck_reg,
            ts.driver_name,
            ts.remarks,
            COUNT(DISTINCT c.id) as total_cartons,
            COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as total_units,
            COUNT(DISTINCT c.shipment_id) as total_pos,
            GROUP_CONCAT(DISTINCT s.customer ORDER BY s.customer SEPARATOR ', ') as customers
        FROM truck_shipments ts
        LEFT JOIN cartons c ON c.truck_shipment_id = ts.id
        LEFT JOIN shipments s ON c.shipment_id = s.id
        {$whereClause}
        GROUP BY ts.id, ts.shipment_date, ts.shipment_week, ts.truck_reg, ts.driver_name, ts.remarks
        ORDER BY ts.shipment_date DESC, ts.created_at DESC
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $trucks = $stmt->fetchAll();
    
    $rows = [[
        'Date',
        'Shipment Week',
        'Truck Registration',
        'Driver',
        'Customers',
        'Total POs',
        'Total Cartons',
        'Total Units',
        'Remarks'
    ]];
    
    foreach ($trucks as $truck) {
        $rows[] = [
            $truck['shipment_date'],
            $truck['shipment_week'] ?? '',
            $truck['truck_reg'],
            $truck['driver_name'] ?? '',
            $truck['customers'] ?? '',
            $truck['total_pos'],
            $truck['total_cartons'],
            $truck['total_units'],
            $truck['remarks'] ?? ''
        ];
    }
    
    csvOutputRows('truck_summary_' . date('Y-m-d') . '.csv', $rows);
    
} catch (Exception $e) {
    http_response_code(400);
    echo 'Error: ' . $e->getMessage();
}

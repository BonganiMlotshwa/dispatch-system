<?php
// CORS headers - must be first
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Cache-Control, X-Requested-With');
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/**
 * Dashboard Statistics API Endpoint
 * 
 * This endpoint provides detailed statistics for the dashboard.
 */

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Only GET method is allowed']);
    exit;
}

// Include required files
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/truck_shipment_helpers.php';

// Short cache time for dashboard stats
$cacheDir = __DIR__ . '/../cache';
$cacheFile = $cacheDir . '/dashboard_stats.json';
$cacheTime = 5; // Very short cache time - 5 seconds for real-time feel
$cachingEnabled = true; // Re-enabled with very short cache

// Check if cache directory exists, create if not
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}

// Allow cache bypass with refresh parameter
$forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === 'true';

// Check if cached data exists and is still valid (unless force refresh or caching disabled)
if ($cachingEnabled && !$forceRefresh && file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTime) {
    $cachedData = file_get_contents($cacheFile);
    if ($cachedData) {
        $decoded = json_decode($cachedData, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            header('X-Cache: HIT');
            echo $cachedData;
            exit;
        }
    }
}

try {
    // Get database connection
    $pdo = getDbConnection();
    
    // Initialize statistics array
    $stats = [];
    
    // Single optimized query for all counts and statistics including units
    $stmt = $pdo->query("SELECT 
        (SELECT COUNT(*) FROM shipments) as total_shipments,
        (SELECT COUNT(*) FROM cartons) as total_cartons,
        (SELECT COALESCE(SUM(CAST(units AS UNSIGNED)), 0) FROM cartons) as total_units,
        SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN c.status = 'entered' THEN 1 ELSE 0 END) as entered_count,
        SUM(CASE WHEN c.status = 'exited' THEN 1 ELSE 0 END) as exited_count,
        SUM(CASE WHEN c.status = 'pending' THEN COALESCE(CAST(c.units AS UNSIGNED), 0) ELSE 0 END) as pending_units,
        SUM(CASE WHEN c.status = 'entered' THEN COALESCE(CAST(c.units AS UNSIGNED), 0) ELSE 0 END) as factory_units,
        SUM(CASE WHEN c.status = 'exited' THEN COALESCE(CAST(c.units AS UNSIGNED), 0) ELSE 0 END) as shipped_units,
        SUM(CASE WHEN c.qc_number IS NULL THEN 1 ELSE 0 END) as missing_qc,
        SUM(CASE WHEN c.finishing_number IS NULL THEN 1 ELSE 0 END) as missing_finishing
        FROM cartons c");
    $combined = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Get legacy warehouse goods statistics - COUNT ALL STATUSES
    $legacyStats = ['orders' => 0, 'cartons' => 0, 'units' => 0];
    $legacyTableExists = (bool)$pdo->query("SHOW TABLES LIKE 'legacy_warehouse_goods'")->fetch();
    if ($legacyTableExists) {
        $stmt = $pdo->query("SELECT 
            COUNT(*) as orders_count,
            COALESCE(SUM(cartons_count), 0) as total_cartons,
            COALESCE(SUM(quantity_inside), 0) as total_units
            FROM legacy_warehouse_goods");
            -- Removed WHERE status = 'active' to count ALL statuses
        $legacy = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($legacy) {
            $legacyStats = [
                'orders' => (int)$legacy['orders_count'],
                'cartons' => (int)$legacy['total_cartons'],
                'units' => (int)$legacy['total_units']
            ];
        }
    }
    
    $stats['totals'] = [
        'total_shipments' => (int)$combined['total_shipments'],
        'total_cartons' => (int)$combined['total_cartons'],
        'total_units' => (int)$combined['total_units'] + $legacyStats['units']
    ];
    
    $stats['status_counts'] = [
        'pending' => (int)$combined['pending_count'],
        'entered' => (int)$combined['entered_count'],
        'exited' => (int)$combined['exited_count'],
        'received' => (int)$combined['entered_count'] + (int)$combined['exited_count'] // Cartons received (entered + exited)
    ];
    
    $stats['unit_counts'] = [
        'pending_units' => (int)$combined['pending_units'],
        'factory_units' => (int)$combined['factory_units'] + $legacyStats['units'],
        'shipped_units' => (int)$combined['shipped_units'],
        'total_units' => (int)$combined['total_units'] + $legacyStats['units']
    ];
    
    $stats['legacy_warehouse'] = $legacyStats;
    
    $stats['missing_data'] = [
        'missing_qc' => (int)$combined['missing_qc'],
        'missing_finishing' => (int)$combined['missing_finishing']
    ];
    
    // Get recent shipments
    $stmt = $pdo->query("SELECT 
        s.id, 
        s.internal_po_number, 
        s.file_name, 
        s.import_date,
        COUNT(c.id) as carton_count,
        SUM(CASE WHEN c.status = 'entered' THEN 1 ELSE 0 END) as entered_count,
        SUM(CASE WHEN c.status = 'exited' THEN 1 ELSE 0 END) as exited_count
        FROM shipments s
        LEFT JOIN cartons c ON s.id = c.shipment_id
        GROUP BY s.id
        ORDER BY s.import_date DESC
        LIMIT 5");
    $recentShipments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $stats['recent_shipments'] = $recentShipments;
    
    // Get size distribution
    $stmt = $pdo->query("SELECT 
        size, 
        COUNT(*) as count 
        FROM cartons 
        GROUP BY size 
        ORDER BY count DESC
        LIMIT 10");
    $sizeDistribution = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $stats['size_distribution'] = $sizeDistribution;
    
    // Get daily activity (last 7 days)
    $stmt = $pdo->query("SELECT 
        DATE(scan_timestamp) as date,
        COUNT(CASE WHEN status = 'entered' THEN 1 END) as entered,
        COUNT(CASE WHEN status = 'exited' THEN 1 END) as exited
        FROM cartons 
        WHERE scan_timestamp IS NOT NULL
        AND scan_timestamp >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(scan_timestamp)
        ORDER BY date ASC");
    $dailyActivity = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $stats['daily_activity'] = $dailyActivity;

    $scheduleTableExists = (bool)$pdo->query("SHOW TABLES LIKE 'delivery_schedules'")->fetch();
    $stats['weekly_analysis'] = [];
    if ($scheduleTableExists) {
        $stmt = $pdo->query("SELECT
            ds.id,
            ds.week_label,
            ds.file_name,
            ds.order_count,
            ds.is_active,
            ds.imported_at,
            COUNT(DISTINCT s.id) as shipment_count,
            COALESCE(COUNT(c.id), 0) as expected_cartons,
            COALESCE(SUM(CASE WHEN c.status IN ('entered', 'exited') THEN 1 ELSE 0 END), 0) as received,
            COALESCE(SUM(CASE WHEN c.status = 'entered' THEN 1 ELSE 0 END), 0) as in_warehouse,
            COALESCE(SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END), 0) as pending_to_enter,
            COALESCE(SUM(CASE WHEN c.status = 'exited' THEN 1 ELSE 0 END), 0) as shipped
            FROM delivery_schedules ds
            LEFT JOIN shipments s ON s.schedule_id = ds.id
            LEFT JOIN cartons c ON c.shipment_id = s.id
            GROUP BY ds.id, ds.week_label, ds.file_name, ds.order_count, ds.is_active, ds.imported_at
            ORDER BY ds.imported_at DESC, ds.id DESC
            LIMIT 12");
        $weeklyAnalysis = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($weeklyAnalysis as &$week) {
            $week['id'] = (int)$week['id'];
            $week['order_count'] = (int)$week['order_count'];
            $week['is_active'] = (int)$week['is_active'];
            $week['shipment_count'] = (int)$week['shipment_count'];
            $week['expected_cartons'] = (int)$week['expected_cartons'];
            $week['received'] = (int)$week['received'];
            $week['in_warehouse'] = (int)$week['in_warehouse'];
            $week['pending_to_enter'] = (int)$week['pending_to_enter'];
            $week['shipped'] = (int)$week['shipped'];
        }
        unset($week);
        $stats['weekly_analysis'] = $weeklyAnalysis;
    }

    $stats['weekly_outbound'] = [];
    $truckTableExists = (bool)$pdo->query("SHOW TABLES LIKE 'truck_shipments'")->fetch();
    if ($truckTableExists) {
        $legacyJoin = truckShipmentLegacyItemsTableExists($pdo);
        $legacySub = $legacyJoin ? "
            LEFT JOIN (
                SELECT YEAR(ts.shipment_date) AS ship_year, ts.shipment_week,
                    COUNT(DISTINCT tli.legacy_goods_id) AS legacy_orders,
                    COALESCE(SUM(tli.cartons_shipped), 0) AS legacy_cartons,
                    COALESCE(SUM(tli.units_shipped), 0) AS legacy_units
                FROM truck_shipments ts
                INNER JOIN truck_shipment_legacy_items tli ON tli.truck_shipment_id = ts.id
                WHERE ts.shipment_week IS NOT NULL AND ts.shipment_week != ''
                GROUP BY YEAR(ts.shipment_date), ts.shipment_week
            ) lg ON lg.ship_year = w.ship_year AND lg.shipment_week = w.shipment_week
        " : '';
        $legacyCols = $legacyJoin
            ? ', COALESCE(lg.legacy_orders, 0) AS legacy_orders, COALESCE(lg.legacy_cartons, 0) AS legacy_cartons, COALESCE(lg.legacy_units, 0) AS legacy_units'
            : ', 0 AS legacy_orders, 0 AS legacy_cartons, 0 AS legacy_units';

        $stmt = $pdo->query("
            SELECT
                w.ship_year,
                w.shipment_week,
                w.week_start,
                w.truck_loads,
                COALESCE(sc.cartons_shipped, 0) AS cartons_shipped,
                COALESCE(sc.units_shipped, 0) AS units_shipped
                {$legacyCols}
            FROM (
                SELECT YEAR(shipment_date) AS ship_year, shipment_week,
                    MIN(shipment_date) AS week_start, COUNT(*) AS truck_loads
                FROM truck_shipments
                WHERE shipment_week IS NOT NULL AND shipment_week != ''
                GROUP BY YEAR(shipment_date), shipment_week
            ) w
            LEFT JOIN (
                SELECT YEAR(ts.shipment_date) AS ship_year, ts.shipment_week,
                    COUNT(c.id) AS cartons_shipped,
                    COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) AS units_shipped
                FROM truck_shipments ts
                INNER JOIN cartons c ON c.truck_shipment_id = ts.id
                WHERE ts.shipment_week IS NOT NULL AND ts.shipment_week != ''
                GROUP BY YEAR(ts.shipment_date), ts.shipment_week
            ) sc ON sc.ship_year = w.ship_year AND sc.shipment_week = w.shipment_week
            {$legacySub}
            ORDER BY w.week_start DESC
            LIMIT 12
        ");
        $weeklyOutbound = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($weeklyOutbound as &$week) {
            $week['ship_year'] = (int)$week['ship_year'];
            $week['truck_loads'] = (int)$week['truck_loads'];
            $week['cartons_shipped'] = (int)$week['cartons_shipped'];
            $week['units_shipped'] = (int)$week['units_shipped'];
            $week['legacy_orders'] = (int)($week['legacy_orders'] ?? 0);
            $week['legacy_cartons'] = (int)($week['legacy_cartons'] ?? 0);
            $week['legacy_units'] = (int)($week['legacy_units'] ?? 0);
            $week['total_cartons'] = $week['cartons_shipped'] + $week['legacy_cartons'];
            $week['total_units'] = $week['units_shipped'] + $week['legacy_units'];
            $week['week_label'] = $week['shipment_week'] . ' ' . $week['ship_year'];
        }
        unset($week);
        $stats['weekly_outbound'] = $weeklyOutbound;
    }
    
    // Prepare response
    $response = json_encode([
        'success' => true,
        'stats' => $stats
    ]);
    
    // Cache the response only if caching is enabled
    if ($cachingEnabled) {
        file_put_contents($cacheFile, $response, LOCK_EX);
        header('X-Cache: MISS');
    } else {
        header('X-Cache: DISABLED');
    }
    
    // Return success response
    echo $response;
    
} catch (Exception $e) {
    http_response_code(400); // Bad Request
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

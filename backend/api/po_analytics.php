<?php
/**
 * PO Analytics API Endpoint
 * 
 * Provides comprehensive analytics and metrics for individual Purchase Orders
 */

// Set headers for API response
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Cache-Control, X-Requested-With');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only GET method is allowed']);
    exit;
}

// Include required files
require_once '../config/database.php';
require_once '../includes/warehouse_order_statuses.php';

/**
 * Calculate PO analytics and metrics
 */
function calculatePOAnalytics($shipmentId, $timeRange, $pdo) {
    try {
        // Get shipment details
        $stmt = $pdo->prepare("SELECT * FROM shipments WHERE id = ?");
        $stmt->execute([$shipmentId]);
        $shipment = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$shipment) {
            return ['success' => false, 'message' => 'Shipment not found'];
        }

        // Define time range filter
        $timeFilter = '';
        $timeParams = [$shipmentId];
        
        switch ($timeRange) {
            case '1day':
                $timeFilter = 'AND c.updated_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)';
                break;
            case '7days':
                $timeFilter = 'AND c.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
                break;
            case '30days':
                $timeFilter = 'AND c.updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
                break;
            default: // 'all'
                $timeFilter = '';
                break;
        }

        // Get comprehensive carton statistics including unit breakdowns
        $stmt = $pdo->prepare("
            SELECT 
                COUNT(*) as total_cartons,
                SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END) as pending_cartons,
                SUM(CASE WHEN c.status = 'entered' THEN 1 ELSE 0 END) as warehouse_cartons,
                SUM(CASE WHEN c.status = 'exited' THEN 1 ELSE 0 END) as shipped_cartons,
                SUM(CASE WHEN c.qc_number IS NULL THEN 1 ELSE 0 END) as missing_qc,
                SUM(CASE WHEN c.finishing_number IS NULL THEN 1 ELSE 0 END) as missing_finishing,
                SUM(COALESCE(CAST(c.units AS UNSIGNED), 0)) as total_units,
                SUM(CASE WHEN c.status = 'pending' THEN COALESCE(CAST(c.units AS UNSIGNED), 0) ELSE 0 END) as pending_units,
                SUM(CASE WHEN c.status = 'entered' THEN COALESCE(CAST(c.units AS UNSIGNED), 0) ELSE 0 END) as factory_units,
                SUM(CASE WHEN c.status = 'exited' THEN COALESCE(CAST(c.units AS UNSIGNED), 0) ELSE 0 END) as shipped_units,
                AVG(COALESCE(CAST(c.units AS UNSIGNED), 0)) as avg_units_per_carton,
                COUNT(DISTINCT c.size) as size_variations,
                COUNT(DISTINCT c.po_number) as po_variations,
                AVG(
                    CASE 
                        WHEN c.scan_timestamp IS NOT NULL AND c.status = 'exited' 
                        THEN TIMESTAMPDIFF(HOUR, c.created_at, c.scan_timestamp)
                        ELSE NULL
                    END
                ) as avg_processing_time
            FROM cartons c 
            WHERE c.shipment_id = ? {$timeFilter}
        ");
        $stmt->execute($timeParams);
        $analytics = $stmt->fetch(PDO::FETCH_ASSOC);

        $options = warehouseOrderStatusOptions();
        $status = displayWarehouseOrderStatus($shipment['warehouse_order_status'] ?? 'active');
        $shipment['warehouse_order_status'] = $status;
        $shipment['warehouse_order_status_label'] = $options[$status] ?? $status;

        // Get size distribution
        $stmt = $pdo->prepare("
            SELECT 
                c.size,
                COUNT(*) as count,
                SUM(c.units) as total_units,
                SUM(CASE WHEN c.status = 'exited' THEN 1 ELSE 0 END) as shipped_count
            FROM cartons c 
            WHERE c.shipment_id = ? {$timeFilter}
            GROUP BY c.size 
            ORDER BY count DESC
        ");
        $stmt->execute($timeParams);
        $sizeDistribution = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get daily activity (last 30 days)
        $stmt = $pdo->prepare("
            SELECT 
                DATE(c.scan_timestamp) as activity_date,
                SUM(CASE WHEN c.status = 'entered' THEN 1 ELSE 0 END) as entered_count,
                SUM(CASE WHEN c.status = 'exited' THEN 1 ELSE 0 END) as shipped_count
            FROM cartons c 
            WHERE c.shipment_id = ? 
                AND c.scan_timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                AND c.scan_timestamp IS NOT NULL
            GROUP BY DATE(c.scan_timestamp)
            ORDER BY activity_date ASC
        ");
        $stmt->execute([$shipmentId]);
        $dailyActivity = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get quality metrics
        $stmt = $pdo->prepare("
            SELECT 
                COUNT(*) as total_cartons,
                COUNT(CASE WHEN c.qc_number IS NOT NULL THEN 1 END) as qc_complete,
                COUNT(CASE WHEN c.finishing_number IS NOT NULL THEN 1 END) as finishing_complete,
                COUNT(CASE WHEN c.qc_number IS NOT NULL AND c.finishing_number IS NOT NULL THEN 1 END) as fully_complete
            FROM cartons c 
            WHERE c.shipment_id = ? {$timeFilter}
        ");
        $stmt->execute($timeParams);
        $qualityMetrics = $stmt->fetch(PDO::FETCH_ASSOC);

        // Get recent activity/alerts
        $stmt = $pdo->prepare("
            SELECT 
                c.barcode_2d,
                c.status,
                c.scan_timestamp,
                c.qc_number,
                c.finishing_number,
                c.notes
            FROM cartons c 
            WHERE c.shipment_id = ? 
                AND c.updated_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY c.updated_at DESC
            LIMIT 10
        ");
        $stmt->execute([$shipmentId]);
        $recentActivity = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Calculate performance indicators
        $performanceScore = 0;
        if ($analytics['total_cartons'] > 0) {
            $completionRate = ($analytics['shipped_cartons'] / $analytics['total_cartons']) * 100;
            $qualityRate = (($analytics['total_cartons'] - $analytics['missing_qc'] - $analytics['missing_finishing']) / $analytics['total_cartons']) * 100;
            $performanceScore = ($completionRate + $qualityRate) / 2;
        }

        return [
            'success' => true,
            'shipment' => $shipment,
            'analytics' => [
                'total_cartons' => (int)$analytics['total_cartons'],
                'pending_cartons' => (int)$analytics['pending_cartons'],
                'warehouse_cartons' => (int)$analytics['warehouse_cartons'],
                'shipped_cartons' => (int)$analytics['shipped_cartons'],
                'missing_qc' => (int)$analytics['missing_qc'],
                'missing_finishing' => (int)$analytics['missing_finishing'],
                'total_units' => (int)$analytics['total_units'],
                'pending_units' => (int)$analytics['pending_units'],
                'factory_units' => (int)$analytics['factory_units'],
                'shipped_units' => (int)$analytics['shipped_units'],
                'total_units' => (int)$analytics['total_units'],
                'avg_units_per_carton' => round($analytics['avg_units_per_carton'], 2),
                'size_variations' => (int)$analytics['size_variations'],
                'po_variations' => (int)$analytics['po_variations'],
                'avg_processing_time' => round($analytics['avg_processing_time'], 2),
                'performance_score' => round($performanceScore, 1)
            ],
            'size_distribution' => $sizeDistribution,
            'daily_activity' => $dailyActivity,
            'quality_metrics' => [
                'total_cartons' => (int)$qualityMetrics['total_cartons'],
                'qc_complete' => (int)$qualityMetrics['qc_complete'],
                'finishing_complete' => (int)$qualityMetrics['finishing_complete'],
                'fully_complete' => (int)$qualityMetrics['fully_complete'],
                'qc_completion_rate' => $qualityMetrics['total_cartons'] > 0 ? round(($qualityMetrics['qc_complete'] / $qualityMetrics['total_cartons']) * 100, 1) : 0,
                'finishing_completion_rate' => $qualityMetrics['total_cartons'] > 0 ? round(($qualityMetrics['finishing_complete'] / $qualityMetrics['total_cartons']) * 100, 1) : 0
            ],
            'recent_activity' => $recentActivity,
            'timestamp' => date('Y-m-d H:i:s')
        ];

    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

try {
    // Get database connection
    $pdo = getDbConnection();
    
    // Validate required parameters
    if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
        throw new Exception('Missing or invalid shipment ID');
    }
    
    $shipmentId = (int)$_GET['id'];
    $timeRange = isset($_GET['timeRange']) ? $_GET['timeRange'] : '7days';
    
    // Validate time range
    $validTimeRanges = ['1day', '7days', '30days', 'all'];
    if (!in_array($timeRange, $validTimeRanges)) {
        $timeRange = '7days';
    }
    
    // Get analytics data
    $result = calculatePOAnalytics($shipmentId, $timeRange, $pdo);
    
    if (!$result['success']) {
        throw new Exception($result['message']);
    }
    
    // Return analytics data
    echo json_encode($result);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
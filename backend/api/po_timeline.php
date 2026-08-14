<?php
/**
 * PO Timeline API Endpoint
 * 
 * Provides timeline and activity history for Purchase Orders
 */

// Set headers for API response
header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['GET']);

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only GET method is allowed']);
    exit;
}

// Include required files
require_once '../config/database.php';
require_once '../includes/carton_timestamps.php';

/**
 * Get PO timeline data
 */
function getPOTimeline($shipmentId, $pdo) {
    try {
        // Get shipment details
        $stmt = $pdo->prepare("SELECT * FROM shipments WHERE id = ?");
        $stmt->execute([$shipmentId]);
        $shipment = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$shipment) {
            return ['success' => false, 'message' => 'Shipment not found'];
        }

        $isManual = ($shipment['entry_type'] ?? '') === 'manual';

        // Get daily timeline data (last 30 days)
        if ($isManual) {
            $entryExpr = "COALESCE(c.entry_timestamp, c.scan_timestamp, c.created_at)";
            $exitExpr = "COALESCE(c.exit_timestamp, c.scan_timestamp, c.created_at)";
            $stmt = $pdo->prepare("
                SELECT
                    date,
                    SUM(entered) as entered,
                    SUM(shipped) as shipped,
                    SUM(total_activity) as total_activity
                FROM (
                    SELECT
                        DATE({$entryExpr}) as date,
                        COUNT(*) as entered,
                        0 as shipped,
                        COUNT(*) as total_activity
                    FROM cartons c
                    WHERE c.shipment_id = ?
                      AND c.entry_timestamp IS NOT NULL
                      AND {$entryExpr} >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    GROUP BY DATE({$entryExpr})

                    UNION ALL

                    SELECT
                        DATE({$exitExpr}) as date,
                        0 as entered,
                        COUNT(*) as shipped,
                        COUNT(*) as total_activity
                    FROM cartons c
                    WHERE c.shipment_id = ?
                      AND c.exit_timestamp IS NOT NULL
                      AND {$exitExpr} >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    GROUP BY DATE({$exitExpr})
                ) t
                GROUP BY date
                ORDER BY date ASC
            ");
            $stmt->execute([$shipmentId, $shipmentId]);
        } else {
            $stmt = $pdo->prepare("
                SELECT 
                    DATE(COALESCE(c.scan_timestamp, c.created_at)) as date,
                    SUM(CASE WHEN c.status = 'entered' THEN 1 ELSE 0 END) as entered,
                    SUM(CASE WHEN c.status = 'exited' THEN 1 ELSE 0 END) as shipped,
                    COUNT(*) as total_activity
                FROM cartons c 
                WHERE c.shipment_id = ? 
                    AND COALESCE(c.scan_timestamp, c.created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(COALESCE(c.scan_timestamp, c.created_at))
                ORDER BY date ASC
            ");
            $stmt->execute([$shipmentId]);
        }
        $timeline = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get major milestones
        if ($isManual) {
            $stmt = $pdo->prepare("
                SELECT 
                    'import' as event_type,
                    s.import_date as event_date,
                    'Shipment imported' as description,
                    COUNT(c.id) as carton_count
                FROM shipments s
                LEFT JOIN cartons c ON s.id = c.shipment_id
                WHERE s.id = ?
                GROUP BY s.id, s.import_date
                
                UNION ALL
                
                SELECT 
                    'first_entry' as event_type,
                    MIN(c.entry_timestamp) as event_date,
                    'First carton entered' as description,
                    1 as carton_count
                FROM cartons c
                WHERE c.shipment_id = ? AND c.entry_timestamp IS NOT NULL
                
                UNION ALL
                
                SELECT 
                    'first_exit' as event_type,
                    MIN(c.exit_timestamp) as event_date,
                    'First carton exited' as description,
                    1 as carton_count
                FROM cartons c
                WHERE c.shipment_id = ? AND c.exit_timestamp IS NOT NULL
                
                UNION ALL
                
                SELECT 
                    'completion' as event_type,
                    MAX(c.exit_timestamp) as event_date,
                    'Last carton exited' as description,
                    COUNT(*) as carton_count
                FROM cartons c
                WHERE c.shipment_id = ? AND c.exit_timestamp IS NOT NULL
                HAVING COUNT(*) = (SELECT COUNT(*) FROM cartons WHERE shipment_id = ? AND exit_timestamp IS NOT NULL)
                
                ORDER BY event_date ASC
            ");
            $stmt->execute([$shipmentId, $shipmentId, $shipmentId, $shipmentId, $shipmentId]);
        } else {
            $stmt = $pdo->prepare("
                SELECT 
                    'import' as event_type,
                    s.import_date as event_date,
                    'Shipment imported' as description,
                    COUNT(c.id) as carton_count
                FROM shipments s
                LEFT JOIN cartons c ON s.id = c.shipment_id
                WHERE s.id = ?
                GROUP BY s.id, s.import_date
                
                UNION ALL
                
                SELECT 
                    'first_scan' as event_type,
                    MIN(c.scan_timestamp) as event_date,
                    'First carton scanned' as description,
                    1 as carton_count
                FROM cartons c
                WHERE c.shipment_id = ? AND c.scan_timestamp IS NOT NULL
                
                UNION ALL
                
                SELECT 
                    'first_exit' as event_type,
                    MIN(c.scan_timestamp) as event_date,
                    'First carton shipped' as description,
                    1 as carton_count
                FROM cartons c
                WHERE c.shipment_id = ? AND c.status = 'exited' AND c.scan_timestamp IS NOT NULL
                
                UNION ALL
                
                SELECT 
                    'completion' as event_type,
                    MAX(c.scan_timestamp) as event_date,
                    'Last carton shipped' as description,
                    COUNT(*) as carton_count
                FROM cartons c
                WHERE c.shipment_id = ? AND c.status = 'exited' AND c.scan_timestamp IS NOT NULL
                HAVING COUNT(*) = (SELECT COUNT(*) FROM cartons WHERE shipment_id = ?)
                
                ORDER BY event_date ASC
            ");
            $stmt->execute([$shipmentId, $shipmentId, $shipmentId, $shipmentId, $shipmentId]);
        }
        $milestones = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get recent activity details
        if ($isManual) {
            $stmt = $pdo->prepare("
                SELECT 
                    c.barcode_2d,
                    c.status,
                    c.entry_timestamp,
                    c.exit_timestamp,
                    c.updated_at,
                    c.qc_number,
                    c.finishing_number,
                    c.notes,
                    'Updated' as change_description
                FROM cartons c
                WHERE c.shipment_id = ? 
                    AND c.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                ORDER BY c.updated_at DESC
                LIMIT 20
            ");
        } else {
            $stmt = $pdo->prepare("
                SELECT 
                    c.barcode_2d,
                    c.status,
                    c.scan_timestamp,
                    c.updated_at,
                    c.qc_number,
                    c.finishing_number,
                    c.notes,
                    'Updated' as change_description
                FROM cartons c
                WHERE c.shipment_id = ? 
                    AND c.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                ORDER BY c.updated_at DESC
                LIMIT 20
            ");
        }
        $stmt->execute([$shipmentId]);
        $recentActivity = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Calculate processing statistics
        if ($isManual) {
            $stmt = $pdo->prepare("
                SELECT 
                    COUNT(*) as total_cartons,
                    AVG(TIMESTAMPDIFF(HOUR, c.created_at, COALESCE(c.exit_timestamp, c.entry_timestamp, c.created_at))) as avg_processing_hours,
                    MIN(c.entry_timestamp) as first_entry,
                    MAX(c.exit_timestamp) as last_exit,
                    COUNT(CASE WHEN c.exit_timestamp IS NOT NULL THEN 1 END) as completed_cartons
                FROM cartons c
                WHERE c.shipment_id = ? AND (c.entry_timestamp IS NOT NULL OR c.exit_timestamp IS NOT NULL)
            ");
        } else {
            $stmt = $pdo->prepare("
                SELECT 
                    COUNT(*) as total_cartons,
                    AVG(TIMESTAMPDIFF(HOUR, c.created_at, c.scan_timestamp)) as avg_processing_hours,
                    MIN(c.scan_timestamp) as first_scan,
                    MAX(c.scan_timestamp) as last_scan,
                    COUNT(CASE WHEN c.status = 'exited' THEN 1 END) as completed_cartons
                FROM cartons c
                WHERE c.shipment_id = ? AND c.scan_timestamp IS NOT NULL
            ");
        }
        $stmt->execute([$shipmentId]);
        $processingStats = $stmt->fetch(PDO::FETCH_ASSOC);

        // Generate forecast if applicable
        $forecast = [];
        if ($processingStats['completed_cartons'] > 0 && $processingStats['total_cartons'] > $processingStats['completed_cartons']) {
            $remainingCartons = $processingStats['total_cartons'] - $processingStats['completed_cartons'];
            $avgHours = $processingStats['avg_processing_hours'] ?? 24;
            $estimatedCompletion = date('Y-m-d H:i:s', strtotime("+{$avgHours} hours"));
            
            $forecast = [
                'remaining_cartons' => $remainingCartons,
                'estimated_completion' => $estimatedCompletion,
                'confidence' => min(100, ($processingStats['completed_cartons'] / $processingStats['total_cartons']) * 100)
            ];
        }

        return [
            'success' => true,
            'shipment' => $shipment,
            'timeline' => $timeline,
            'milestones' => array_filter($milestones, function($milestone) {
                return $milestone['event_date'] !== null;
            }),
            'recent_activity' => $recentActivity,
            'processing_stats' => [
                'total_cartons' => (int)$processingStats['total_cartons'],
                'avg_processing_hours' => round($processingStats['avg_processing_hours'], 2),
                'first_scan' => $isManual ? ($processingStats['first_entry'] ?? null) : ($processingStats['first_scan'] ?? null),
                'last_scan' => $isManual ? ($processingStats['last_exit'] ?? null) : ($processingStats['last_scan'] ?? null),
                'completed_cartons' => (int)$processingStats['completed_cartons']
            ],
            'forecast' => $forecast,
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
    
    // Get timeline data
    $result = getPOTimeline($shipmentId, $pdo);
    
    if (!$result['success']) {
        throw new Exception($result['message']);
    }
    
    // Return timeline data
    echo json_encode($result);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>

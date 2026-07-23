<?php
/**
 * Provides intelligent recommendations for resolving unlinked files
 * Analyzes patterns and suggests specific actions
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = getDbConnection();
    
    // Get unlinked files
    $unlinkedStmt = $pdo->query(
        "SELECT id, file_name, internal_po_number, customer_order_no, import_date
         FROM shipments 
         WHERE entry_type = 'xml' 
           AND (schedule_id IS NULL OR schedule_id = 0)
         ORDER BY import_date DESC"
    );
    $unlinkedFiles = $unlinkedStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get all unique order numbers from unlinked files
    $unlinkedOrderNumbers = array_values(array_filter(array_unique(
        array_map(fn($f) => trim($f['customer_order_no'] ?? ''), $unlinkedFiles)
    ), fn($o) => $o !== ''));
    
    // Get loaded schedules
    $schedulesStmt = $pdo->query(
        "SELECT id, week_label, order_count, is_active, imported_at
         FROM delivery_schedules
         ORDER BY imported_at DESC"
    );
    $schedules = $schedulesStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get order number ranges from each schedule
    $scheduleRanges = [];
    foreach ($schedules as $schedule) {
        $ordersStmt = $pdo->prepare(
            "SELECT order_no FROM delivery_schedule_orders 
             WHERE schedule_id = ? 
             ORDER BY order_no"
        );
        $ordersStmt->execute([$schedule['id']]);
        $orders = $ordersStmt->fetchAll(PDO::FETCH_COLUMN);
        
        if (!empty($orders)) {
            // Extract numeric orders for range analysis
            $numericOrders = array_filter(array_map('intval', $orders), fn($n) => $n > 0);
            
            if (!empty($numericOrders)) {
                sort($numericOrders);
                $scheduleRanges[$schedule['id']] = [
                    'week_label' => $schedule['week_label'],
                    'order_count' => count($orders),
                    'min_order' => min($numericOrders),
                    'max_order' => max($numericOrders),
                    'sample_orders' => array_slice($orders, 0, 5),
                ];
            }
        }
    }
    
    // Analyze unlinked order numbers for patterns
    $numericUnlinkedOrders = array_filter(array_map('intval', $unlinkedOrderNumbers), fn($n) => $n > 0);
    
    $recommendations = [];
    
    // Recommendation 1: Check if order numbers are outside all schedule ranges
    if (!empty($numericUnlinkedOrders) && !empty($scheduleRanges)) {
        sort($numericUnlinkedOrders);
        $minUnlinked = min($numericUnlinkedOrders);
        $maxUnlinked = max($numericUnlinkedOrders);
        
        $allScheduleMin = min(array_column($scheduleRanges, 'min_order'));
        $allScheduleMax = max(array_column($scheduleRanges, 'max_order'));
        
        if ($minUnlinked > $allScheduleMax) {
            $recommendations[] = [
                'type' => 'warning',
                'priority' => 'high',
                'title' => 'Orders are newer than all loaded schedules',
                'message' => sprintf(
                    'Your unlinked files have order numbers %d-%d, but your schedules only go up to %d. These appear to be newer orders.',
                    $minUnlinked,
                    $maxUnlinked,
                    $allScheduleMax
                ),
                'action' => 'Upload a more recent weekly schedule that contains these higher order numbers.',
                'sample_unlinked_orders' => array_slice($unlinkedOrderNumbers, 0, 5),
                'loaded_schedules' => array_column($scheduleRanges, 'week_label'),
            ];
        } elseif ($maxUnlinked < $allScheduleMin) {
            $recommendations[] = [
                'type' => 'warning',
                'priority' => 'high',
                'title' => 'Orders are older than all loaded schedules',
                'message' => sprintf(
                    'Your unlinked files have order numbers %d-%d, but your schedules start from %d. These appear to be older orders.',
                    $minUnlinked,
                    $maxUnlinked,
                    $allScheduleMin
                ),
                'action' => 'Upload an older weekly schedule OR manually link these legacy orders.',
                'sample_unlinked_orders' => array_slice($unlinkedOrderNumbers, 0, 5),
                'loaded_schedules' => array_column($scheduleRanges, 'week_label'),
            ];
        } else {
            $recommendations[] = [
                'type' => 'info',
                'priority' => 'medium',
                'title' => 'Order numbers overlap with schedule range',
                'message' => sprintf(
                    'Your unlinked orders (%d-%d) are within the range of loaded schedules (%d-%d), but exact matches were not found.',
                    $minUnlinked,
                    $maxUnlinked,
                    $allScheduleMin,
                    $allScheduleMax
                ),
                'action' => 'These might be special orders, cancelled orders, or from a different customer. Consider manual linking.',
                'sample_unlinked_orders' => array_slice($unlinkedOrderNumbers, 0, 5),
            ];
        }
    }
    
    // Recommendation 2: No schedules loaded at all
    if (empty($schedules)) {
        $recommendations[] = [
            'type' => 'danger',
            'priority' => 'critical',
            'title' => 'No weekly schedules loaded',
            'message' => sprintf('You have %d unlinked file(s), but no weekly delivery schedules have been uploaded yet.', count($unlinkedFiles)),
            'action' => 'Upload your first weekly schedule Excel file (.xlsx) to enable automatic linking.',
            'sample_unlinked_orders' => array_slice($unlinkedOrderNumbers, 0, 10),
        ];
    }
    
    // Recommendation 3: Check if backfill might help
    if (!empty($schedules) && !empty($unlinkedFiles)) {
        $recommendations[] = [
            'type' => 'info',
            'priority' => 'low',
            'title' => 'Try the backfill feature',
            'message' => 'The backfill feature can search all loaded schedules for potential matches.',
            'action' => 'Go to Import XML File page → Click "Find orders to link" button in the schedule section.',
        ];
    }
    
    // Recommendation 4: Manual linking is always an option
    if (!empty($unlinkedFiles)) {
        $recommendations[] = [
            'type' => 'secondary',
            'priority' => 'low',
            'title' => 'Manual linking available',
            'message' => sprintf('You can manually link %d file(s) if schedules are not available.', count($unlinkedFiles)),
            'action' => 'Go to Import XML File page → Uploaded Files section → Click "Edit" on each unlinked file.',
        ];
    }
    
    // Summary statistics
    $summary = [
        'total_unlinked_files' => count($unlinkedFiles),
        'unique_unlinked_orders' => count($unlinkedOrderNumbers),
        'loaded_schedules_count' => count($schedules),
        'total_schedule_orders' => array_sum(array_column($schedules, 'order_count')),
    ];
    
    if (!empty($numericUnlinkedOrders)) {
        $summary['unlinked_order_range'] = [
            'min' => min($numericUnlinkedOrders),
            'max' => max($numericUnlinkedOrders),
            'sample' => array_slice($unlinkedOrderNumbers, 0, 10),
        ];
    }
    
    if (!empty($scheduleRanges)) {
        $allOrders = array_merge(...array_map(fn($s) => $s['sample_orders'], $scheduleRanges));
        $summary['schedule_order_range'] = [
            'min' => min(array_column($scheduleRanges, 'min_order')),
            'max' => max(array_column($scheduleRanges, 'max_order')),
            'sample' => array_slice($allOrders, 0, 10),
        ];
    }
    
    echo json_encode([
        'success' => true,
        'summary' => $summary,
        'recommendations' => $recommendations,
        'schedule_details' => array_values($scheduleRanges),
        'unlinked_files' => array_map(function($f) {
            return [
                'file_name' => $f['file_name'],
                'customer_order_no' => $f['customer_order_no'],
                'import_date' => $f['import_date'],
            ];
        }, $unlinkedFiles),
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}

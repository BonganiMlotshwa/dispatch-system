<?php
/**
 * Diagnostic tool to identify why files aren't linking to schedules
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/schedule_parser.php';

try {
    $pdo = getDbConnection();
    
    // Get all schedules
    $schedulesStmt = $pdo->query(
        "SELECT id, week_label, file_name, order_count, is_active, imported_at 
         FROM delivery_schedules 
         ORDER BY imported_at DESC"
    );
    $schedules = $schedulesStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get all order numbers from schedules
    $scheduleOrdersStmt = $pdo->query(
        "SELECT dso.order_no, dso.indent_no, dso.description, dso.colour, 
                ds.week_label, ds.id as schedule_id, ds.is_active
         FROM delivery_schedule_orders dso
         INNER JOIN delivery_schedules ds ON ds.id = dso.schedule_id
         ORDER BY ds.imported_at DESC, dso.order_no"
    );
    $scheduleOrders = $scheduleOrdersStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get all unlinked shipments (files without schedule_id)
    $unlinkedStmt = $pdo->query(
        "SELECT id, file_name, internal_po_number, customer_order_no, 
                style, color, order_qty, import_date, schedule_id, entry_type
         FROM shipments 
         WHERE entry_type = 'xml' AND (schedule_id IS NULL OR schedule_id = 0)
         ORDER BY import_date DESC"
    );
    $unlinkedFiles = $unlinkedStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get all linked shipments for comparison
    $linkedStmt = $pdo->query(
        "SELECT s.id, s.file_name, s.internal_po_number, s.customer_order_no,
                s.style, s.color, s.order_qty, s.import_date, s.schedule_id,
                ds.week_label
         FROM shipments s
         LEFT JOIN delivery_schedules ds ON ds.id = s.schedule_id
         WHERE s.entry_type = 'xml' AND s.schedule_id IS NOT NULL AND s.schedule_id > 0
         ORDER BY s.import_date DESC"
    );
    $linkedFiles = $linkedStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Analyze potential matches for unlinked files
    $matchAnalysis = [];
    foreach ($unlinkedFiles as $file) {
        $customerOrderNo = scheduleNormalizeOrderNo(trim($file['customer_order_no'] ?? ''));

        if ($customerOrderNo === '') {
            $matchAnalysis[] = [
                'file_name' => $file['file_name'],
                'customer_order_no' => 'MISSING',
                'status' => 'No customer order number in file',
                'potential_matches' => [],
            ];
            continue;
        }

        // Look for exact matches (both sides normalised — same logic as the real lookup)
        $exactMatches = [];
        foreach ($scheduleOrders as $order) {
            if (scheduleNormalizeOrderNo(trim($order['order_no'])) === $customerOrderNo) {
                $exactMatches[] = [
                    'schedule_week' => $order['week_label'],
                    'schedule_id' => $order['schedule_id'],
                    'is_active' => (bool)$order['is_active'],
                    'indent_no' => $order['indent_no'],
                    'ftm_po' => 'FTM-' . $order['indent_no'],
                    'description' => $order['description'],
                    'colour' => $order['colour'],
                    'match_type' => 'exact',
                ];
            }
        }
        
        // Look for case-insensitive matches (order numbers are numeric so this catches
        // edge cases where a non-numeric part differs only by case)
        $caseInsensitiveMatches = [];
        if (empty($exactMatches)) {
            foreach ($scheduleOrders as $order) {
                if (strcasecmp(scheduleNormalizeOrderNo(trim($order['order_no'])), $customerOrderNo) === 0) {
                    $caseInsensitiveMatches[] = [
                        'schedule_week' => $order['week_label'],
                        'schedule_id' => $order['schedule_id'],
                        'is_active' => (bool)$order['is_active'],
                        'indent_no' => $order['indent_no'],
                        'ftm_po' => 'FTM-' . $order['indent_no'],
                        'description' => $order['description'],
                        'colour' => $order['colour'],
                        'match_type' => 'case_insensitive',
                        'schedule_value' => $order['order_no'],
                        'file_value' => $customerOrderNo,
                    ];
                }
            }
        }
        
        // Partial / numeric-value matches — these indicate data that the normaliser
        // couldn't fix automatically (e.g. truncated or reformatted order numbers).
        $numericMatches = [];
        $partialMatches = [];
        if (empty($exactMatches) && empty($caseInsensitiveMatches)) {
            $customerInt = ctype_digit($customerOrderNo) ? (int)$customerOrderNo : -1;
            foreach ($scheduleOrders as $order) {
                $orderNo = scheduleNormalizeOrderNo(trim($order['order_no']));
                $orderInt = ctype_digit($orderNo) ? (int)$orderNo : -2;
                if ($customerInt >= 0 && $customerInt === $orderInt && $orderNo !== $customerOrderNo) {
                    $numericMatches[] = [
                        'schedule_week' => $order['week_label'],
                        'schedule_id' => $order['schedule_id'],
                        'is_active' => (bool)$order['is_active'],
                        'indent_no' => $order['indent_no'],
                        'ftm_po' => 'FTM-' . $order['indent_no'],
                        'match_type' => 'numeric',
                        'schedule_value' => $orderNo,
                        'file_value' => $customerOrderNo,
                    ];
                } elseif (
                    empty($numericMatches)
                    && (stripos($orderNo, $customerOrderNo) !== false || stripos($customerOrderNo, $orderNo) !== false)
                ) {
                    $partialMatches[] = [
                        'schedule_week' => $order['week_label'],
                        'schedule_id' => $order['schedule_id'],
                        'is_active' => (bool)$order['is_active'],
                        'indent_no' => $order['indent_no'],
                        'ftm_po' => 'FTM-' . $order['indent_no'],
                        'match_type' => 'partial',
                        'schedule_value' => $orderNo,
                        'file_value' => $customerOrderNo,
                    ];
                }
            }
        }

        $status = 'No matches found';
        if (!empty($exactMatches)) {
            $status = 'EXACT MATCH FOUND - Should have linked!';
        } elseif (!empty($caseInsensitiveMatches)) {
            $status = 'Case mismatch detected';
        } elseif (!empty($numericMatches)) {
            $status = 'Leading zero mismatch - same order number, different padding';
        } elseif (!empty($partialMatches)) {
            $status = 'Partial match found - formatting issue';
        }
        
        $matchAnalysis[] = [
            'file_name' => $file['file_name'],
            'customer_order_no' => $customerOrderNo,
            'import_date' => $file['import_date'],
            'status' => $status,
            'exact_matches' => $exactMatches,
            'case_insensitive_matches' => $caseInsensitiveMatches,
            'numeric_matches' => $numericMatches,
            'partial_matches' => array_slice($partialMatches, 0, 3),
        ];
    }
    
    // Get active schedule info
    $activeScheduleStmt = $pdo->query(
        "SELECT id, week_label, file_name, order_count 
         FROM delivery_schedules 
         WHERE is_active = 1 
         LIMIT 1"
    );
    $activeSchedule = $activeScheduleStmt->fetch(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'summary' => [
            'total_schedules' => count($schedules),
            'total_schedule_orders' => count($scheduleOrders),
            'unlinked_files' => count($unlinkedFiles),
            'linked_files' => count($linkedFiles),
            'active_schedule' => $activeSchedule,
        ],
        'schedules' => $schedules,
        'unlinked_files' => $unlinkedFiles,
        'linked_files' => $linkedFiles,
        'match_analysis' => $matchAnalysis,
        'all_schedule_orders' => $scheduleOrders,
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}

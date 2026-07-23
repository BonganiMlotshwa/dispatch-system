<?php
require_once __DIR__ . '/config/database.php';

$pdo = getDbConnection();

echo "=== SCHEDULE ORDERS (Sample) ===\n";
$scheduleOrders = $pdo->query("SELECT order_no FROM delivery_schedule_orders ORDER BY id LIMIT 30")->fetchAll(PDO::FETCH_COLUMN);
foreach ($scheduleOrders as $order) {
    echo $order . "\n";
}

echo "\n=== UNLINKED FILES (Customer Order Numbers) ===\n";
$unlinkedFiles = $pdo->query("SELECT file_name, customer_order_no FROM shipments WHERE entry_type = 'xml' AND (schedule_id IS NULL OR schedule_id = 0) ORDER BY id LIMIT 30")->fetchAll(PDO::FETCH_ASSOC);
foreach ($unlinkedFiles as $file) {
    echo $file['customer_order_no'] . " - " . $file['file_name'] . "\n";
}

echo "\n=== CHECKING IF ANY MATCH ===\n";
$unlinkedOrderNos = array_column($unlinkedFiles, 'customer_order_no');
$matchFound = false;
foreach ($unlinkedOrderNos as $fileOrder) {
    if (in_array($fileOrder, $scheduleOrders, true)) {
        echo "MATCH FOUND: $fileOrder exists in schedule!\n";
        $matchFound = true;
    }
}
if (!$matchFound) {
    echo "No exact matches found between unlinked files and schedule orders.\n";
    echo "\nThis suggests the order numbers in your files are NOT in the loaded schedules.\n";
}

echo "\n=== TOTAL COUNTS ===\n";
$totalScheduleOrders = $pdo->query("SELECT COUNT(*) FROM delivery_schedule_orders")->fetchColumn();
$totalUnlinked = $pdo->query("SELECT COUNT(*) FROM shipments WHERE entry_type = 'xml' AND (schedule_id IS NULL OR schedule_id = 0)")->fetchColumn();
echo "Total orders in schedules: $totalScheduleOrders\n";
echo "Total unlinked files: $totalUnlinked\n";

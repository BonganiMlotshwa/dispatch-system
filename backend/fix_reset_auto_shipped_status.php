<?php
/**
 * Reset auto-assigned Shipped back to Active (status is manual only).
 * php backend/fix_reset_auto_shipped_status.php
 */
require_once __DIR__ . '/config/database.php';

$pdo = getDbConnection();
$col = $pdo->query("SHOW COLUMNS FROM shipments LIKE 'warehouse_order_status'")->fetch();
if (!$col) {
    echo "Column not found — run migrate_shipment_warehouse_status.php first.\n";
    exit(1);
}

$stmt = $pdo->exec("UPDATE shipments SET warehouse_order_status = 'active' WHERE warehouse_order_status = 'shipped'");
echo "Reset {$stmt} order(s) from Shipped to Active (mark Shipped manually when needed).\n";

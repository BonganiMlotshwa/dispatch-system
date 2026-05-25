<?php
/**
 * Adds warehouse_order_status to shipments (spec 1.5).
 * php backend/migrate_shipment_warehouse_status.php
 */
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/warehouse_order_statuses.php';

$pdo = getDbConnection();

$stmt = $pdo->query("SHOW COLUMNS FROM shipments LIKE 'warehouse_order_status'");
if (!$stmt->fetch()) {
    $pdo->exec("
        ALTER TABLE shipments
        ADD COLUMN warehouse_order_status VARCHAR(50) NOT NULL DEFAULT 'active'
        COMMENT 'Spec 1.5: active, shipped, cancelled, not_audited, failed_audit, waiting_for_booking'
        AFTER entry_type
    ");
    echo "Added warehouse_order_status to shipments\n";
}

// All orders default to active; only user-assigned statuses differ
$pdo->exec("UPDATE shipments SET warehouse_order_status = 'active' WHERE warehouse_order_status IS NULL OR warehouse_order_status = ''");
echo "All orders default to active unless explicitly set otherwise.\n";

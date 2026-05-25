<?php
/**
 * Adds loading_status to truck_shipments (open = can continue loading, closed = done).
 * php backend/migrate_truck_loading_status.php
 */
require_once __DIR__ . '/config/database.php';

$pdo = getDbConnection();

$stmt = $pdo->query("SHOW COLUMNS FROM truck_shipments LIKE 'loading_status'");
if (!$stmt->fetch()) {
    $pdo->exec("
        ALTER TABLE truck_shipments
        ADD COLUMN loading_status ENUM('open','closed') NOT NULL DEFAULT 'open'
        COMMENT 'open = loading in progress, closed = finished'
        AFTER remarks
    ");
    echo "Added loading_status column\n";
} else {
    echo "loading_status already exists\n";
}

$pdo->exec("UPDATE truck_shipments SET loading_status = 'open' WHERE loading_status IS NULL OR loading_status = ''");
echo "Migration complete.\n";

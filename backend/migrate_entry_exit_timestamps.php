<?php
/**
 * Run once: adds entry_timestamp and exit_timestamp to cartons.
 * php backend/migrate_entry_exit_timestamps.php
 */
require_once __DIR__ . '/config/database.php';

$pdo = getDbConnection();

function columnExists(PDO $pdo, $column) {
    $stmt = $pdo->query("SHOW COLUMNS FROM cartons LIKE " . $pdo->quote($column));
    return (bool)$stmt->fetch();
}

if (!columnExists($pdo, 'entry_timestamp')) {
    $pdo->exec("ALTER TABLE cartons ADD COLUMN entry_timestamp DATETIME DEFAULT NULL COMMENT 'When carton entered warehouse' AFTER scan_timestamp");
    echo "Added entry_timestamp\n";
} else {
    echo "entry_timestamp already exists\n";
}

if (!columnExists($pdo, 'exit_timestamp')) {
    $pdo->exec("ALTER TABLE cartons ADD COLUMN exit_timestamp DATETIME DEFAULT NULL COMMENT 'When carton exited warehouse' AFTER entry_timestamp");
    echo "Added exit_timestamp\n";
} else {
    echo "exit_timestamp already exists\n";
}

$pdo->exec("UPDATE cartons SET entry_timestamp = scan_timestamp WHERE entry_timestamp IS NULL AND status IN ('entered', 'exited') AND scan_timestamp IS NOT NULL");
echo "Backfilled entry_timestamp\n";

$pdo->exec("UPDATE cartons SET exit_timestamp = scan_timestamp WHERE exit_timestamp IS NULL AND status = 'exited' AND scan_timestamp IS NOT NULL");
echo "Backfilled exit_timestamp\n";

echo "Migration complete.\n";

<?php
return static function (PDO $pdo): void {
    $stmt = $pdo->query("SHOW COLUMNS FROM `cartons` LIKE 'entry_timestamp'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE `cartons` ADD COLUMN `entry_timestamp` DATETIME DEFAULT NULL COMMENT 'When carton entered warehouse' AFTER `scan_timestamp`");
    }

    $stmt = $pdo->query("SHOW COLUMNS FROM `cartons` LIKE 'exit_timestamp'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE `cartons` ADD COLUMN `exit_timestamp` DATETIME DEFAULT NULL COMMENT 'When carton exited warehouse' AFTER `entry_timestamp`");
    }

    // Backfill from scan_timestamp for rows already in the DB
    $pdo->exec("UPDATE `cartons` SET `entry_timestamp` = `scan_timestamp` WHERE `entry_timestamp` IS NULL AND `status` IN ('entered','exited') AND `scan_timestamp` IS NOT NULL");
    $pdo->exec("UPDATE `cartons` SET `exit_timestamp` = `scan_timestamp` WHERE `exit_timestamp` IS NULL AND `status` = 'exited' AND `scan_timestamp` IS NOT NULL");
};

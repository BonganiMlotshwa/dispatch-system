<?php
return static function (PDO $pdo): void {
    $stmt = $pdo->query("SHOW COLUMNS FROM `truck_shipments` LIKE 'loading_status'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE `truck_shipments`
            ADD COLUMN `loading_status` ENUM('open','closed') NOT NULL DEFAULT 'open'
            COMMENT 'open = loading in progress, closed = finished'
            AFTER `remarks`");
    }
    $pdo->exec("UPDATE `truck_shipments` SET `loading_status` = 'open' WHERE `loading_status` IS NULL OR `loading_status` = ''");
};

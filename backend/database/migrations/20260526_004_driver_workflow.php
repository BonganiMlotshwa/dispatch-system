<?php
return static function (PDO $pdo): void {
    $stmt = $pdo->query("SHOW COLUMNS FROM `cartons` LIKE 'truck_shipment_id'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE `cartons` ADD COLUMN `truck_shipment_id` int(11) DEFAULT NULL COMMENT 'Link to truck shipment for exit scans' AFTER `scan_type`");
    }

    try {
        $pdo->exec("ALTER TABLE `cartons` ADD KEY `idx_truck_shipment_id` (`truck_shipment_id`)");
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate key name') === false) {
            throw $e;
        }
    }

    $stmt = $pdo->query("SHOW COLUMNS FROM `scan_audit_log` LIKE 'truck_shipment_id'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE `scan_audit_log` ADD COLUMN `truck_shipment_id` int(11) DEFAULT NULL COMMENT 'Truck shipment for exit scans' AFTER `scanned_by`");
    }
};

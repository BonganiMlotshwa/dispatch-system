<?php
return static function (PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `truck_shipments` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `shipment_date` date NOT NULL COMMENT 'Date of shipment',
        `shipment_week` varchar(10) DEFAULT NULL COMMENT 'Week number (e.g., Wk16)',
        `truck_reg` varchar(50) NOT NULL COMMENT 'Truck registration number',
        `driver_name` varchar(100) DEFAULT NULL COMMENT 'Driver name',
        `remarks` text DEFAULT NULL COMMENT 'Remarks (e.g., shipment incomplete)',
        `created_at` datetime NOT NULL DEFAULT current_timestamp(),
        `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (`id`),
        KEY `idx_shipment_date` (`shipment_date`),
        KEY `idx_truck_reg` (`truck_reg`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `truck_shipment_items` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `truck_shipment_id` int(11) NOT NULL COMMENT 'Foreign key to truck_shipments',
        `shipment_id` int(11) NOT NULL COMMENT 'Foreign key to shipments (PO)',
        `cartons_shipped` int(11) NOT NULL DEFAULT 0 COMMENT 'Number of cartons shipped',
        `units_shipped` int(11) NOT NULL DEFAULT 0 COMMENT 'Number of units shipped',
        `created_at` datetime NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (`id`),
        KEY `truck_shipment_id` (`truck_shipment_id`),
        KEY `shipment_id` (`shipment_id`),
        CONSTRAINT `truck_shipment_items_ibfk_1` FOREIGN KEY (`truck_shipment_id`) REFERENCES `truck_shipments` (`id`) ON DELETE CASCADE,
        CONSTRAINT `truck_shipment_items_ibfk_2` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $stmt = $pdo->query("SHOW COLUMNS FROM `cartons` LIKE 'scanned_by'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE `cartons` ADD COLUMN `scanned_by` varchar(100) DEFAULT NULL COMMENT 'User who scanned the carton' AFTER `scan_timestamp`");
    }

    $stmt = $pdo->query("SHOW COLUMNS FROM `cartons` LIKE 'scan_type'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE `cartons` ADD COLUMN `scan_type` enum('entry','exit') DEFAULT NULL COMMENT 'Type of scan (entry/exit)' AFTER `scanned_by`");
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS `scan_audit_log` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `carton_id` int(11) NOT NULL COMMENT 'Foreign key to cartons',
        `scan_type` enum('entry','exit') NOT NULL COMMENT 'Type of scan',
        `scan_timestamp` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'When the scan occurred',
        `scanned_by` varchar(100) DEFAULT NULL COMMENT 'User who performed the scan',
        `previous_status` enum('pending','entered','exited') DEFAULT NULL COMMENT 'Status before scan',
        `new_status` enum('pending','entered','exited') NOT NULL COMMENT 'Status after scan',
        `notes` text DEFAULT NULL COMMENT 'Additional notes',
        PRIMARY KEY (`id`),
        KEY `carton_id` (`carton_id`),
        KEY `idx_scan_timestamp` (`scan_timestamp`),
        KEY `idx_scan_type` (`scan_type`),
        CONSTRAINT `scan_audit_log_ibfk_1` FOREIGN KEY (`carton_id`) REFERENCES `cartons` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};

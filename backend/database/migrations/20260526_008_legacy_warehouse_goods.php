<?php
return static function (PDO $pdo): void {
    // Includes customer_other (added later by a one-off script, absorbed here for fresh installs)
    $pdo->exec("CREATE TABLE IF NOT EXISTS `legacy_warehouse_goods` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `internal_po` varchar(50) NOT NULL COMMENT 'FTM PO e.g. FTM-15730',
        `customer_order_number` varchar(50) DEFAULT NULL COMMENT 'Customer order number',
        `customer` varchar(50) DEFAULT 'MRP',
        `customer_other` varchar(100) DEFAULT NULL COMMENT 'Custom customer name when customer = Other',
        `style` varchar(200) DEFAULT NULL,
        `color` varchar(100) DEFAULT NULL,
        `order_qty` int(11) DEFAULT NULL,
        `quantity_inside` int(11) DEFAULT NULL COMMENT 'Units currently in warehouse',
        `cartons_label` varchar(50) DEFAULT NULL COMMENT 'e.g. 70 CTNS',
        `cartons_count` int(11) DEFAULT NULL,
        `status` varchar(50) NOT NULL DEFAULT 'in_warehouse',
        `remarks` text DEFAULT NULL,
        `new_developments` text DEFAULT NULL,
        `shipped_qty` int(11) DEFAULT 0,
        `source_year` smallint(6) DEFAULT 2025 COMMENT 'Order year e.g. 2025',
        `created_at` datetime NOT NULL DEFAULT current_timestamp(),
        `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (`id`),
        KEY `idx_status` (`status`),
        KEY `idx_internal_po` (`internal_po`),
        KEY `idx_customer` (`customer`),
        KEY `idx_source_year` (`source_year`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Ensure customer_other exists on databases where the table pre-dated this column
    $stmt = $pdo->query("SHOW COLUMNS FROM `legacy_warehouse_goods` LIKE 'customer_other'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE `legacy_warehouse_goods` ADD COLUMN `customer_other` varchar(100) DEFAULT NULL COMMENT 'Custom customer name when customer = Other' AFTER `customer`");
    }
};

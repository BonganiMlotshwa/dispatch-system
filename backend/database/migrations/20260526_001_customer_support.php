<?php
return static function (PDO $pdo): void {
    $cols = [
        'customer'   => "ALTER TABLE `shipments` ADD COLUMN `customer` VARCHAR(50) NOT NULL DEFAULT 'MRP' COMMENT 'Customer name (MRP, OTB, OBSW, etc.)' AFTER `internal_po_number`",
        'style'      => "ALTER TABLE `shipments` ADD COLUMN `style` VARCHAR(100) DEFAULT NULL COMMENT 'Style information'",
        'color'      => "ALTER TABLE `shipments` ADD COLUMN `color` VARCHAR(50) DEFAULT NULL COMMENT 'Color information'",
        'order_qty'  => "ALTER TABLE `shipments` ADD COLUMN `order_qty` INT DEFAULT NULL COMMENT 'Total order quantity'",
        'entry_type' => "ALTER TABLE `shipments` ADD COLUMN `entry_type` ENUM('xml','manual') NOT NULL DEFAULT 'xml' COMMENT 'How the shipment was created'",
    ];
    foreach ($cols as $col => $sql) {
        $stmt = $pdo->query("SHOW COLUMNS FROM `shipments` LIKE " . $pdo->quote($col));
        if ($stmt->rowCount() === 0) {
            $pdo->exec($sql);
        }
    }

    foreach (['idx_customer' => 'customer', 'idx_entry_type' => 'entry_type'] as $idx => $col) {
        try {
            $pdo->exec("CREATE INDEX `$idx` ON `shipments` (`$col`)");
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'Duplicate key name') === false) {
                throw $e;
            }
        }
    }
};

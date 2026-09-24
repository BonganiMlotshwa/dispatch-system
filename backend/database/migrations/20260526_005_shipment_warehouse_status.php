<?php
return static function (PDO $pdo): void {
    $stmt = $pdo->query("SHOW COLUMNS FROM `shipments` LIKE 'warehouse_order_status'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE `shipments`
            ADD COLUMN `warehouse_order_status` VARCHAR(50) NOT NULL DEFAULT 'active'
            COMMENT 'Spec 1.5: active, shipped, cancelled, not_audited, failed_audit, waiting_for_booking'
            AFTER `entry_type`");
    }
    $pdo->exec("UPDATE `shipments` SET `warehouse_order_status` = 'active' WHERE `warehouse_order_status` IS NULL OR `warehouse_order_status` = ''");
};

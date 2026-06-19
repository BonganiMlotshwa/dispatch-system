<?php

return static function (PDO $pdo): void {
    $columns = [
        'customer_order_no' => "VARCHAR(50) NULL COMMENT 'MRP/customer order number from .mrpg PoNumber' AFTER `customer`",
        'schedule_status' => "ENUM('linked','unlinked','manual') NOT NULL DEFAULT 'manual' COMMENT 'Schedule link state' AFTER `entry_type`",
        'schedule_id' => "INT NULL COMMENT 'Matched delivery_schedules.id' AFTER `schedule_status`",
        'schedule_week_label' => "VARCHAR(50) NULL COMMENT 'Week label from matched schedule' AFTER `schedule_id`",
    ];

    foreach ($columns as $name => $definition) {
        $check = $pdo->query("SHOW COLUMNS FROM shipments LIKE " . $pdo->quote($name));
        if ($check->fetch()) {
            echo "Column {$name} already exists.\n";
            continue;
        }
        $pdo->exec("ALTER TABLE shipments ADD COLUMN `{$name}` {$definition}");
        echo "Added column {$name}.\n";
    }

    $idx = $pdo->query("SHOW INDEX FROM shipments WHERE Key_name = 'idx_shipments_customer_order_no'");
    if (!$idx->fetch()) {
        $pdo->exec('CREATE INDEX idx_shipments_customer_order_no ON shipments (customer_order_no)');
        echo "Added index idx_shipments_customer_order_no.\n";
    }

    $idx2 = $pdo->query("SHOW INDEX FROM shipments WHERE Key_name = 'idx_shipments_schedule_status'");
    if (!$idx2->fetch()) {
        $pdo->exec('CREATE INDEX idx_shipments_schedule_status ON shipments (schedule_status)');
        echo "Added index idx_shipments_schedule_status.\n";
    }

    echo "Shipment schedule link columns ready.\n";
};

<?php

return static function (PDO $pdo): void {
    $legacyCol = $pdo->query("SHOW COLUMNS FROM legacy_warehouse_goods LIKE 'shipment_week'")->fetch();
    if (!$legacyCol) {
        $pdo->exec("
            ALTER TABLE legacy_warehouse_goods
            ADD COLUMN shipment_week varchar(10) DEFAULT NULL COMMENT 'Outbound week e.g. Wk16' AFTER shipped_qty,
            ADD COLUMN shipped_at datetime DEFAULT NULL COMMENT 'When marked shipped' AFTER shipment_week,
            ADD COLUMN truck_shipment_id int(11) DEFAULT NULL COMMENT 'Outbound truck shipment record' AFTER shipped_at,
            ADD KEY idx_legacy_shipment_week (shipment_week),
            ADD KEY idx_legacy_truck_shipment_id (truck_shipment_id)
        ");
        echo "legacy_warehouse_goods outbound columns added.\n";
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS truck_shipment_legacy_items (
            id int(11) NOT NULL AUTO_INCREMENT,
            truck_shipment_id int(11) NOT NULL,
            legacy_goods_id int(11) NOT NULL,
            cartons_shipped int(11) NOT NULL DEFAULT 0,
            units_shipped int(11) NOT NULL DEFAULT 0,
            created_at datetime NOT NULL DEFAULT current_timestamp(),
            PRIMARY KEY (id),
            UNIQUE KEY uq_truck_legacy_goods (truck_shipment_id, legacy_goods_id),
            KEY idx_legacy_goods_id (legacy_goods_id),
            KEY idx_truck_shipment_id (truck_shipment_id),
            CONSTRAINT truck_shipment_legacy_items_truck_fk
                FOREIGN KEY (truck_shipment_id) REFERENCES truck_shipments(id) ON DELETE CASCADE,
            CONSTRAINT truck_shipment_legacy_items_legacy_fk
                FOREIGN KEY (legacy_goods_id) REFERENCES legacy_warehouse_goods(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "truck_shipment_legacy_items table ready.\n";
};

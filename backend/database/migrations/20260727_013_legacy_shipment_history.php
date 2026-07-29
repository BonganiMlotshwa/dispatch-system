<?php

/**
 * Preserve legacy shipment history permanently.
 *
 * 1. Add snapshot columns to truck_shipment_legacy_items so the record survives
 *    even if the source legacy_warehouse_goods row is later deleted.
 * 2. Change the legacy_goods_id FK from CASCADE to RESTRICT so shipped records
 *    cannot be accidentally wiped by deleting the parent row.
 */
return static function (PDO $pdo): void {

    // --- 1. Add snapshot columns if missing ---
    $existing = $pdo->query("SHOW COLUMNS FROM truck_shipment_legacy_items")->fetchAll(PDO::FETCH_COLUMN);

    $toAdd = [];
    if (!in_array('internal_po', $existing)) {
        $toAdd[] = "ADD COLUMN internal_po VARCHAR(50) DEFAULT NULL COMMENT 'Snapshot: FTM PO at time of ship'";
    }
    if (!in_array('style', $existing)) {
        $toAdd[] = "ADD COLUMN style VARCHAR(200) DEFAULT NULL COMMENT 'Snapshot: style at time of ship'";
    }
    if (!in_array('color', $existing)) {
        $toAdd[] = "ADD COLUMN color VARCHAR(100) DEFAULT NULL COMMENT 'Snapshot: color at time of ship'";
    }
    if (!in_array('cartons_label', $existing)) {
        $toAdd[] = "ADD COLUMN cartons_label VARCHAR(50) DEFAULT NULL COMMENT 'Snapshot: carton label at time of ship'";
    }

    if ($toAdd) {
        $pdo->exec("ALTER TABLE truck_shipment_legacy_items " . implode(', ', $toAdd));
        echo "truck_shipment_legacy_items: snapshot columns added.\n";
    } else {
        echo "truck_shipment_legacy_items: snapshot columns already present.\n";
    }

    // Backfill snapshots for existing rows that have a linked source
    $pdo->exec("
        UPDATE truck_shipment_legacy_items t
        JOIN legacy_warehouse_goods l ON l.id = t.legacy_goods_id
        SET
            t.internal_po  = COALESCE(t.internal_po,  l.internal_po),
            t.style        = COALESCE(t.style,        l.style),
            t.color        = COALESCE(t.color,        l.color),
            t.cartons_label = COALESCE(t.cartons_label, l.cartons_label)
        WHERE t.internal_po IS NULL OR t.style IS NULL OR t.color IS NULL
    ");
    echo "truck_shipment_legacy_items: existing rows backfilled.\n";

    // --- 2. Swap FK: CASCADE → RESTRICT on legacy_goods_id ---
    $fkRows = $pdo->query("
        SELECT CONSTRAINT_NAME
        FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'truck_shipment_legacy_items'
          AND REFERENCED_TABLE_NAME = 'legacy_warehouse_goods'
    ")->fetchAll(PDO::FETCH_COLUMN);

    foreach ($fkRows as $fkName) {
        $pdo->exec("ALTER TABLE truck_shipment_legacy_items DROP FOREIGN KEY `{$fkName}`");
        echo "Dropped FK: {$fkName}\n";
    }

    $pdo->exec("
        ALTER TABLE truck_shipment_legacy_items
        ADD CONSTRAINT truck_legacy_items_legacy_fk
            FOREIGN KEY (legacy_goods_id) REFERENCES legacy_warehouse_goods(id)
            ON DELETE RESTRICT
    ");
    echo "truck_shipment_legacy_items: FK changed to RESTRICT — shipped history is now protected.\n";
};

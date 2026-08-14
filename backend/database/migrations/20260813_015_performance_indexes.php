<?php
/**
 * Migration: Performance indexes for hot query paths
 * Adds composite and timestamp indexes that were missing from the original schema.
 */

return static function (PDO $pdo): void {
    // Helper: add index only if it doesn't already exist
    $addIndex = function (string $table, string $indexName, string $sql) use ($pdo): void {
        $stmt = $pdo->prepare(
            "SELECT COUNT(*) FROM information_schema.statistics
             WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?"
        );
        $stmt->execute([$table, $indexName]);
        if ((int)$stmt->fetchColumn() === 0) {
            $pdo->exec($sql);
        }
    };

    // Composite (shipment_id, status) on cartons — covers all status-count subqueries
    $addIndex(
        'cartons',
        'idx_shipment_status',
        "ALTER TABLE cartons ADD INDEX idx_shipment_status (shipment_id, status)"
    );

    // entry_timestamp on cartons — getDailyEnteredByCustomer() date-range filter
    $addIndex(
        'cartons',
        'idx_entry_timestamp',
        "ALTER TABLE cartons ADD INDEX idx_entry_timestamp (entry_timestamp)"
    );

    // exit_timestamp on cartons — exit scan queries and date-range filters
    $addIndex(
        'cartons',
        'idx_exit_timestamp',
        "ALTER TABLE cartons ADD INDEX idx_exit_timestamp (exit_timestamp)"
    );

    // is_active on delivery_schedules — scheduleGetActive() lookup
    $addIndex(
        'delivery_schedules',
        'idx_is_active',
        "ALTER TABLE delivery_schedules ADD INDEX idx_is_active (is_active)"
    );

    // Composite on truck_shipments for exact-match dispatch lookups
    $addIndex(
        'truck_shipments',
        'idx_dispatch_lookup',
        "ALTER TABLE truck_shipments ADD INDEX idx_dispatch_lookup (shipment_date, truck_reg(20), driver_name(50), shipment_week(10))"
    );
};

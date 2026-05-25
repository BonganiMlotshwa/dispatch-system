<?php
/**
 * Re-sync warehouse_order_status for every shipment from carton scans.
 * php backend/sync_all_shipment_statuses.php
 */
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/sync_shipment_warehouse_status.php';

$pdo = getDbConnection();
$ids = $pdo->query('SELECT id FROM shipments')->fetchAll(PDO::FETCH_COLUMN);
foreach ($ids as $id) {
    syncShipmentWarehouseStatus($pdo, (int)$id);
}
echo 'Synced ' . count($ids) . " shipment(s).\n";

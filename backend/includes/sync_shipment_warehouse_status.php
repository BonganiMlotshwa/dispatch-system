<?php
require_once __DIR__ . '/warehouse_order_statuses.php';

/**
 * Update warehouse_order_status from carton scans (unless a manual status is set).
 */
function syncShipmentWarehouseStatus(PDO $pdo, $shipmentId) {
    $col = $pdo->query("SHOW COLUMNS FROM shipments LIKE 'warehouse_order_status'")->fetch();
    if (!$col) {
        return;
    }

    $stmt = $pdo->prepare("
        SELECT warehouse_order_status,
            (SELECT COUNT(*) FROM cartons WHERE shipment_id = s.id) AS carton_count,
            (SELECT COUNT(*) FROM cartons WHERE shipment_id = s.id AND status = 'entered') AS entered_count,
            (SELECT COUNT(*) FROM cartons WHERE shipment_id = s.id AND status = 'exited') AS exited_count,
            (SELECT COUNT(*) FROM cartons WHERE shipment_id = s.id AND status = 'pending') AS pending_count
        FROM shipments s WHERE s.id = ?
    ");
    $stmt->execute([$shipmentId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return;
    }

    $stored = normalizeWarehouseOrderStatus($row['warehouse_order_status'] ?? 'active');
    if (isManualWarehouseOrderStatus($stored)) {
        return;
    }

    $derived = deriveWarehouseOrderStatusFromCartons(
        $row['carton_count'],
        $row['entered_count'],
        $row['exited_count'],
        $row['pending_count']
    );

    if ($derived !== $stored) {
        $upd = $pdo->prepare('UPDATE shipments SET warehouse_order_status = ? WHERE id = ?');
        $upd->execute([$derived, $shipmentId]);
    }
}

<?php
/**
 * Truck shipment helpers — auto shipment week + accountability for all outbound goods.
 */

require_once __DIR__ . '/carton_timestamps.php';
require_once __DIR__ . '/sync_shipment_warehouse_status.php';

/** ISO calendar week label e.g. Wk16 */
function formatShipmentWeek(?string $date = null): string
{
    $ts = $date ? strtotime($date) : time();
    if ($ts === false) {
        $ts = time();
    }
    return 'Wk' . (int)date('W', $ts);
}

function truckShipmentsHasLoadingStatus(PDO $pdo): bool
{
    static $cached = null;
    if ($cached === null) {
        $cached = (bool)$pdo->query("SHOW COLUMNS FROM truck_shipments LIKE 'loading_status'")->fetch();
    }
    return $cached;
}

function legacyShipmentColumnsExist(PDO $pdo): bool
{
    static $cached = null;
    if ($cached === null) {
        $cached = (bool)$pdo->query("SHOW COLUMNS FROM legacy_warehouse_goods LIKE 'shipment_week'")->fetch();
    }
    return $cached;
}

function legacyItemsHasSnapshotColumns(PDO $pdo): bool
{
    static $cached = null;
    if ($cached === null) {
        $cached = (bool)$pdo->query("SHOW COLUMNS FROM truck_shipment_legacy_items LIKE 'internal_po'")->fetch();
    }
    return $cached;
}

function truckShipmentLegacyItemsTableExists(PDO $pdo): bool
{
    static $cached = null;
    if ($cached === null) {
        $cached = (bool)$pdo->query("SHOW TABLES LIKE 'truck_shipment_legacy_items'")->fetch();
    }
    return $cached;
}

/**
 * Reuse an open truck for the same day/reg/driver/week, or create a new one.
 */
function getOrCreateTruckShipmentForDispatch(
    PDO $pdo,
    string $truckReg,
    string $driverName,
    ?string $shipmentDate = null,
    ?string $shipmentWeek = null,
    ?string $remarks = null
): int {
    $truckReg = trim($truckReg);
    $driverName = trim($driverName);
    if ($truckReg === '' || $driverName === '') {
        throw new Exception('Truck registration and driver name are required for shipment week tracking.');
    }

    $shipmentDate = $shipmentDate ?: date('Y-m-d');
    $shipmentWeek = $shipmentWeek ?: formatShipmentWeek($shipmentDate);

    $hasLoading = truckShipmentsHasLoadingStatus($pdo);
    $sql = '
        SELECT id FROM truck_shipments
        WHERE shipment_date = ? AND truck_reg = ? AND driver_name = ? AND shipment_week = ?
    ';
    if ($hasLoading) {
        $sql .= " AND loading_status = 'open'";
    }
    $sql .= ' ORDER BY id DESC LIMIT 1';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$shipmentDate, $truckReg, $driverName, $shipmentWeek]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($existing) {
        return (int)$existing['id'];
    }

    if ($hasLoading) {
        $stmt = $pdo->prepare('
            INSERT INTO truck_shipments (shipment_date, shipment_week, truck_reg, driver_name, remarks, loading_status)
            VALUES (?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([$shipmentDate, $shipmentWeek, $truckReg, $driverName, $remarks, 'open']);
    } else {
        $stmt = $pdo->prepare('
            INSERT INTO truck_shipments (shipment_date, shipment_week, truck_reg, driver_name, remarks)
            VALUES (?, ?, ?, ?, ?)
        ');
        $stmt->execute([$shipmentDate, $shipmentWeek, $truckReg, $driverName, $remarks]);
    }

    return (int)$pdo->lastInsertId();
}

/**
 * Link exited cartons to a truck shipment and upsert per-PO line items.
 *
 * @param int[] $cartonIds
 */
function assignCartonsToTruckShipment(PDO $pdo, int $truckShipmentId, array $cartonIds): void
{
    $cartonIds = array_values(array_unique(array_map('intval', $cartonIds)));
    if ($cartonIds === []) {
        return;
    }

    $placeholders = implode(',', array_fill(0, count($cartonIds), '?'));
    $stmt = $pdo->prepare("
        SELECT id, shipment_id, units
        FROM cartons
        WHERE id IN ($placeholders)
    ");
    $stmt->execute($cartonIds);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if ($rows === []) {
        return;
    }

    $hasTruckCol = (bool)$pdo->query("SHOW COLUMNS FROM cartons LIKE 'truck_shipment_id'")->fetch();
    if ($hasTruckCol) {
        $stmtUp = $pdo->prepare("UPDATE cartons SET truck_shipment_id = ? WHERE id IN ($placeholders)");
        $stmtUp->execute(array_merge([$truckShipmentId], $cartonIds));
    }

    $byShipment = [];
    foreach ($rows as $row) {
        $sid = (int)($row['shipment_id'] ?? 0);
        if ($sid <= 0) {
            continue;
        }
        if (!isset($byShipment[$sid])) {
            $byShipment[$sid] = ['cartons' => 0, 'units' => 0];
        }
        $byShipment[$sid]['cartons']++;
        $byShipment[$sid]['units'] += (int)($row['units'] ?? 0);
    }

    foreach ($byShipment as $shipmentId => $counts) {
        $stmtDup = $pdo->prepare('SELECT id, cartons_shipped, units_shipped FROM truck_shipment_items WHERE truck_shipment_id = ? AND shipment_id = ?');
        $stmtDup->execute([$truckShipmentId, $shipmentId]);
        $existing = $stmtDup->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            $stmtItem = $pdo->prepare('
                UPDATE truck_shipment_items
                SET cartons_shipped = ?, units_shipped = ?
                WHERE id = ?
            ');
            $stmtItem->execute([
                (int)$existing['cartons_shipped'] + $counts['cartons'],
                (int)$existing['units_shipped'] + $counts['units'],
                (int)$existing['id'],
            ]);
        } else {
            $stmtItem = $pdo->prepare('
                INSERT INTO truck_shipment_items (truck_shipment_id, shipment_id, cartons_shipped, units_shipped)
                VALUES (?, ?, ?, ?)
            ');
            $stmtItem->execute([$truckShipmentId, $shipmentId, $counts['cartons'], $counts['units']]);
        }
        syncShipmentWarehouseStatus($pdo, $shipmentId);
    }
}

/**
 * Record direct-ship carton exits under a shipment week (manual OTB/OBSW mark-as-shipped).
 *
 * @param int[] $cartonIds
 * @return array{truck_shipment_id:int, shipment_week:string}
 */
function recordOutboundShipForCartons(
    PDO $pdo,
    array $cartonIds,
    string $truckReg,
    string $driverName,
    ?string $shipmentDate = null,
    ?string $shipmentWeek = null
): array {
    $shipmentDate = $shipmentDate ?: date('Y-m-d');
    $shipmentWeek = $shipmentWeek ?: formatShipmentWeek($shipmentDate);
    $truckShipmentId = getOrCreateTruckShipmentForDispatch($pdo, $truckReg, $driverName, $shipmentDate, $shipmentWeek);
    assignCartonsToTruckShipment($pdo, $truckShipmentId, $cartonIds);

    return [
        'truck_shipment_id' => $truckShipmentId,
        'shipment_week' => $shipmentWeek,
    ];
}

/**
 * Record legacy warehouse stock marked as shipped.
 *
 * @return array{truck_shipment_id:int, shipment_week:string}
 */
function recordLegacyOutboundShip(
    PDO $pdo,
    int $legacyId,
    ?string $truckReg = null,
    ?string $driverName = null,
    ?string $shipmentDate = null,
    ?string $shipmentWeek = null
): array {
    if (!truckShipmentLegacyItemsTableExists($pdo)) {
        throw new Exception('Legacy shipment tracking is not installed. Run: php backend/database/migrate.php');
    }

    $stmt = $pdo->prepare('SELECT * FROM legacy_warehouse_goods WHERE id = ?');
    $stmt->execute([$legacyId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new Exception('Legacy entry not found');
    }

    $truckReg = trim((string)($truckReg ?: 'LEGACY'));
    $driverName = trim((string)($driverName ?: 'Legacy stock'));
    $shipmentDate = $shipmentDate ?: date('Y-m-d');
    $shipmentWeek = $shipmentWeek ?: formatShipmentWeek($shipmentDate);

    $cartonsShipped = (int)($row['cartons_count'] ?? 0);
    if ($cartonsShipped <= 0 && !empty($row['cartons_label']) && preg_match('/(\d+)/', $row['cartons_label'], $m)) {
        $cartonsShipped = (int)$m[1];
    }
    $unitsShipped = (int)($row['shipped_qty'] ?? 0);
    if ($unitsShipped <= 0) {
        $unitsShipped = (int)($row['quantity_inside'] ?? 0);
    }

    $remarks = 'Legacy: ' . ($row['internal_po'] ?? ('#' . $legacyId));
    $truckShipmentId = getOrCreateTruckShipmentForDispatch($pdo, $truckReg, $driverName, $shipmentDate, $shipmentWeek, $remarks);

    $snapshotPo     = $row['internal_po'] ?? null;
    $snapshotStyle  = $row['style'] ?? null;
    $snapshotColor  = $row['color'] ?? null;
    $snapshotLabel  = $row['cartons_label'] ?? null;

    // Upsert: write snapshot columns when migration 013 has been applied.
    if (legacyItemsHasSnapshotColumns($pdo)) {
        $stmtIns = $pdo->prepare('
            INSERT INTO truck_shipment_legacy_items
                (truck_shipment_id, legacy_goods_id, cartons_shipped, units_shipped,
                 internal_po, style, color, cartons_label)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                cartons_shipped = VALUES(cartons_shipped),
                units_shipped   = VALUES(units_shipped),
                internal_po     = VALUES(internal_po),
                style           = VALUES(style),
                color           = VALUES(color),
                cartons_label   = VALUES(cartons_label)
        ');
        $stmtIns->execute([
            $truckShipmentId, $legacyId, $cartonsShipped, $unitsShipped,
            $snapshotPo, $snapshotStyle, $snapshotColor, $snapshotLabel,
        ]);
    } else {
        $stmtIns = $pdo->prepare('
            INSERT INTO truck_shipment_legacy_items
                (truck_shipment_id, legacy_goods_id, cartons_shipped, units_shipped)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                cartons_shipped = VALUES(cartons_shipped),
                units_shipped   = VALUES(units_shipped)
        ');
        $stmtIns->execute([$truckShipmentId, $legacyId, $cartonsShipped, $unitsShipped]);
    }

    if (legacyShipmentColumnsExist($pdo)) {
        $stmtUp = $pdo->prepare('
            UPDATE legacy_warehouse_goods
            SET shipment_week = ?, shipped_at = COALESCE(shipped_at, NOW()), truck_shipment_id = ?
            WHERE id = ?
        ');
        $stmtUp->execute([$shipmentWeek, $truckShipmentId, $legacyId]);
    }

    return [
        'truck_shipment_id' => $truckShipmentId,
        'shipment_week' => $shipmentWeek,
    ];
}

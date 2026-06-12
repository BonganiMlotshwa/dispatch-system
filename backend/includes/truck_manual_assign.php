<?php
/**
 * Assign manually entered (non-MRP) orders to a truck without per-carton scanning.
 */

require_once __DIR__ . '/carton_timestamps.php';
require_once __DIR__ . '/carton_status_helpers.php';
require_once __DIR__ . '/sync_shipment_warehouse_status.php';

function isNonMrpCustomer($customer) {
    return strtoupper(trim((string)$customer)) !== 'MRP';
}

/** Manual OTB/OBSW/etc. — not MRP (Mr Price must use exit scanner). */
function canDirectShipShipment($entryType, $customer) {
    return strtolower(trim((string)$entryType)) === 'manual' && isNonMrpCustomer($customer);
}

/**
 * Block direct "mark as shipped" for MRP and non-manual orders.
 *
 * @param int[] $cartonIds
 */
function assertCartonsAllowDirectShip(PDO $pdo, array $cartonIds) {
    $cartonIds = array_values(array_unique(array_map('intval', $cartonIds)));
    if ($cartonIds === []) {
        return;
    }

    $placeholders = implode(',', array_fill(0, count($cartonIds), '?'));
    $stmt = $pdo->prepare("
        SELECT c.id, s.entry_type, s.customer, s.internal_po_number
        FROM cartons c
        INNER JOIN shipments s ON s.id = c.shipment_id
        WHERE c.id IN ($placeholders)
    ");
    $stmt->execute($cartonIds);

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!canDirectShipShipment($row['entry_type'] ?? '', $row['customer'] ?? 'MRP')) {
            $po = $row['internal_po_number'] ?? ('carton #' . $row['id']);
            if (!isNonMrpCustomer($row['customer'] ?? 'MRP')) {
                throw new Exception("PO {$po} is Mr Price — use the exit scanner to ship cartons.");
            }
            throw new Exception("PO {$po} must be shipped using the exit scanner.");
        }
    }
}

/**
 * @param PDO $pdo
 * @param int $truckShipmentId
 * @param array<int, array{shipment_id:int, cartons_shipped?:int, units_shipped?:int}> $orders
 * @return array{assigned: array, errors: array}
 */
function assignManualOrdersToTruck(PDO $pdo, $truckShipmentId, array $orders) {
    $truckShipmentId = (int)$truckShipmentId;
    if ($truckShipmentId <= 0) {
        throw new Exception('Invalid truck shipment');
    }

    $stmtTruck = $pdo->prepare('SELECT id FROM truck_shipments WHERE id = ?');
    $stmtTruck->execute([$truckShipmentId]);
    if (!$stmtTruck->fetch()) {
        throw new Exception('Truck shipment not found');
    }

    $hasTsCols = cartonTimestampColumnsExist($pdo);
    $assigned = [];
    $errors = [];

    $stmtShipment = $pdo->prepare("
        SELECT id, customer, internal_po_number, entry_type
        FROM shipments
        WHERE id = ?
    ");
    $stmtCartons = $pdo->prepare("
        SELECT id, status, units
        FROM cartons
        WHERE shipment_id = ?
        AND status IN ('pending', 'entered')
    ");
    foreach ($orders as $order) {
        $shipmentId = (int)($order['shipment_id'] ?? 0);
        if ($shipmentId <= 0) {
            $errors[] = 'Invalid shipment id';
            continue;
        }

        try {
            $stmtShipment->execute([$shipmentId]);
            $shipment = $stmtShipment->fetch(PDO::FETCH_ASSOC);
            if (!$shipment) {
                throw new Exception("Shipment #{$shipmentId} not found");
            }
            if (($shipment['entry_type'] ?? '') !== 'manual') {
                throw new Exception("PO {$shipment['internal_po_number']} is not a manual entry order");
            }
            if (!isNonMrpCustomer($shipment['customer'])) {
                throw new Exception("PO {$shipment['internal_po_number']} is MRP — use carton scanning instead");
            }

            $stmtCartons->execute([$shipmentId]);
            $cartons = $stmtCartons->fetchAll(PDO::FETCH_ASSOC);
            if (count($cartons) === 0) {
                throw new Exception("No cartons in warehouse for {$shipment['internal_po_number']}");
            }

            $cartonsShipped = 0;
            $unitsShipped = 0;

            foreach ($cartons as $carton) {
                $tsUpdate = buildCartonStatusTimestampUpdate('exited', $carton['status'], $hasTsCols);
                $stmtUp = $pdo->prepare("UPDATE cartons SET {$tsUpdate['sql']}, truck_shipment_id = ? WHERE id = ?");
                $stmtUp->execute(array_merge($tsUpdate['params'], [$truckShipmentId, $carton['id']]));
                $cartonsShipped++;
                $unitsShipped += (int)$carton['units'];
            }

            // Allow override from UI (partial ship)
            if (isset($order['cartons_shipped']) && (int)$order['cartons_shipped'] > 0) {
                $cartonsShipped = (int)$order['cartons_shipped'];
            }
            if (isset($order['units_shipped']) && (int)$order['units_shipped'] > 0) {
                $unitsShipped = (int)$order['units_shipped'];
            }

            $stmtDup = $pdo->prepare('SELECT id FROM truck_shipment_items WHERE truck_shipment_id = ? AND shipment_id = ?');
            $stmtDup->execute([$truckShipmentId, $shipmentId]);
            if ($stmtDup->fetch()) {
                $stmtUpItem = $pdo->prepare('
                    UPDATE truck_shipment_items
                    SET cartons_shipped = ?, units_shipped = ?
                    WHERE truck_shipment_id = ? AND shipment_id = ?
                ');
                $stmtUpItem->execute([$cartonsShipped, $unitsShipped, $truckShipmentId, $shipmentId]);
            } else {
                $stmtIns = $pdo->prepare('
                    INSERT INTO truck_shipment_items (truck_shipment_id, shipment_id, cartons_shipped, units_shipped)
                    VALUES (?, ?, ?, ?)
                ');
                $stmtIns->execute([$truckShipmentId, $shipmentId, $cartonsShipped, $unitsShipped]);
            }

            syncShipmentWarehouseStatus($pdo, $shipmentId);

            $assigned[] = [
                'shipment_id' => $shipmentId,
                'internal_po_number' => $shipment['internal_po_number'],
                'customer' => $shipment['customer'],
                'cartons_shipped' => $cartonsShipped,
                'units_shipped' => $unitsShipped
            ];
        } catch (Exception $e) {
            $errors[] = $e->getMessage();
        }
    }

    return ['assigned' => $assigned, 'errors' => $errors];
}

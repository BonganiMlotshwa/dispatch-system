<?php
/**
 * Truck Manifest API
 * GET ?id=<truck_shipment_id>
 * Returns per-PO carton/unit breakdown for a truck — combines
 * MRP scanned cartons (cartons table) and legacy manual items.
 */

header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['GET']);
require_once '../includes/auth.php';
auth_require_user();
require_once '../config/database.php';

try {
    $pdo = getDbConnection();
    $id  = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'id is required']);
        exit;
    }

    // Truck header
    $stmt = $pdo->prepare('SELECT * FROM truck_shipments WHERE id = ?');
    $stmt->execute([$id]);
    $truck = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$truck) {
        echo json_encode(['success' => false, 'message' => 'Truck not found']);
        exit;
    }

    // ── MRP cartons scanned onto this truck ──────────────────────────────────
    $stmt = $pdo->prepare("
        SELECT
            s.internal_po_number  AS po_number,
            s.customer,
            s.style,
            COUNT(c.id)                                AS cartons,
            COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) AS units
        FROM   cartons   c
        INNER  JOIN shipments s ON s.id = c.shipment_id
        WHERE  c.truck_shipment_id = ?
        GROUP  BY s.id, s.internal_po_number, s.customer, s.style
        ORDER  BY s.internal_po_number
    ");
    $stmt->execute([$id]);
    $mrpRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // ── Legacy manual items ──────────────────────────────────────────────────
    $legacyRows = [];
    $legacyExists = (bool)$pdo->query("SHOW TABLES LIKE 'truck_shipment_legacy_items'")->fetch();
    if ($legacyExists) {
        $stmt = $pdo->prepare("
            SELECT
                COALESCE(lg.internal_po, lg.customer_order_number, 'Manual') AS po_number,
                lg.customer,
                COALESCE(lg.style, '')              AS style,
                tli.cartons_shipped                 AS cartons,
                tli.units_shipped                   AS units
            FROM   truck_shipment_legacy_items tli
            INNER  JOIN legacy_warehouse_goods lg ON lg.id = tli.legacy_goods_id
            WHERE  tli.truck_shipment_id = ?
            ORDER  BY lg.internal_po
        ");
        $stmt->execute([$id]);
        $legacyRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // ── Manually assigned shipment items (truck_shipment_items) ──────────────
    $stmt = $pdo->prepare("
        SELECT
            s.internal_po_number AS po_number,
            s.customer,
            s.style,
            tsi.cartons_shipped  AS cartons,
            tsi.units_shipped    AS units
        FROM   truck_shipment_items tsi
        INNER  JOIN shipments s ON s.id = tsi.shipment_id
        WHERE  tsi.truck_shipment_id = ?
        ORDER  BY s.internal_po_number
    ");
    $stmt->execute([$id]);
    $manualItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // ── Merge: MRP rows first, then legacy, then manual items not already in MRP
    $mrpPoNumbers = array_column($mrpRows, 'po_number');
    $extraManual  = array_filter($manualItems, fn($r) => !in_array($r['po_number'], $mrpPoNumbers));

    $allRows = array_merge(
        array_map(fn($r) => array_merge($r, ['source' => 'MRP']),     $mrpRows),
        array_map(fn($r) => array_merge($r, ['source' => 'Prev Year']),  $legacyRows),
        array_map(fn($r) => array_merge($r, ['source' => 'Manual']),  array_values($extraManual))
    );

    // Cast to int
    foreach ($allRows as &$row) {
        $row['cartons'] = (int)$row['cartons'];
        $row['units']   = (int)$row['units'];
    }
    unset($row);

    $totalCartons = array_sum(array_column($allRows, 'cartons'));
    $totalUnits   = array_sum(array_column($allRows, 'units'));

    echo json_encode([
        'success' => true,
        'truck'   => $truck,
        'pos'     => $allRows,
        'totals'  => [
            'cartons' => $totalCartons,
            'units'   => $totalUnits,
            'pos'     => count($allRows),
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

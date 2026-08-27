<?php

header('Content-Type: application/json');

require_once '../includes/cors.php';
cors_headers(['GET']);
require_once '../includes/auth.php';
auth_require_user();



if ($_SERVER['REQUEST_METHOD'] !== 'GET') {

    http_response_code(405);

    echo json_encode(['success' => false, 'message' => 'Only GET method is allowed']);

    exit;

}



require_once '../config/database.php';

require_once '../includes/carton_timestamps.php';



try {

    $pdo = getDbConnection();

    $date = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d');

    $receivedOnDate = cartonReceivedOnDateSql('c');

    $receivedOnDateCx = cartonReceivedOnDateSql('cx');



    // Count cartons received on this date (including those later shipped the same day)

    $stmt = $pdo->prepare("

        SELECT 

            s.customer,

            s.internal_po_number,

            (SELECT po_number FROM cartons WHERE shipment_id = s.id LIMIT 1) as customer_po_number,

            COUNT(c.id) as cartons_expected,

            COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as units_expected,

            COUNT(CASE WHEN {$receivedOnDate} THEN 1 END) as cartons_entered_today,

            COALESCE(SUM(CASE WHEN {$receivedOnDate} THEN CAST(c.units AS UNSIGNED) ELSE 0 END), 0) as units_entered_today,

            COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as cartons_pending,

            COALESCE(SUM(CASE WHEN c.status = 'pending' THEN CAST(c.units AS UNSIGNED) ELSE 0 END), 0) as units_pending

        FROM shipments s

        INNER JOIN cartons c ON s.id = c.shipment_id

        WHERE EXISTS (

            SELECT 1 FROM cartons cx

            WHERE cx.shipment_id = s.id

            AND {$receivedOnDateCx}

        )

        GROUP BY s.id, s.customer, s.internal_po_number

        HAVING cartons_entered_today > 0

        ORDER BY s.customer ASC, s.internal_po_number ASC

    ");

    $stmt->execute([$date, $date, $date]);

    $poSummary = $stmt->fetchAll(PDO::FETCH_ASSOC);



    $totals = [

        'units_expected' => 0,

        'cartons_expected' => 0,

        'units_entered_today' => 0,

        'cartons_entered_today' => 0,

        'units_pending' => 0,

        'cartons_pending' => 0,

        'orders_count' => count($poSummary)

    ];



    foreach ($poSummary as $row) {

        $totals['units_expected'] += $row['units_expected'];

        $totals['cartons_expected'] += $row['cartons_expected'];

        $totals['units_entered_today'] += $row['units_entered_today'];

        $totals['cartons_entered_today'] += $row['cartons_entered_today'];

        $totals['units_pending'] += $row['units_pending'];

        $totals['cartons_pending'] += $row['cartons_pending'];

    }



    // Legacy goods shipped on this date
    $legacyShipped = [];
    $legacyShippedTotals = ['orders' => 0, 'cartons' => 0, 'units' => 0];
    $legacyTableExists = (bool)$pdo->query("SHOW TABLES LIKE 'legacy_warehouse_goods'")->fetch();
    if ($legacyTableExists) {
        $truckTableExists = (bool)$pdo->query("SHOW TABLES LIKE 'truck_shipments'")->fetch();
        $truckJoin = $truckTableExists
            ? 'LEFT JOIN truck_shipments ts ON ts.id = l.truck_shipment_id'
            : '';
        $truckCols = $truckTableExists
            ? ', ts.truck_reg, ts.driver_name'
            : ', NULL AS truck_reg, NULL AS driver_name';

        $legacyStmt = $pdo->prepare(
            "SELECT l.internal_po, l.customer_order_number, l.customer, l.style, l.color,
                    l.cartons_count, l.shipped_qty, l.shipped_at, l.shipment_week
                    {$truckCols}
             FROM legacy_warehouse_goods l {$truckJoin}
             WHERE DATE(l.shipped_at) = ?
             ORDER BY l.internal_po ASC"
        );
        $legacyStmt->execute([$date]);
        $legacyShipped = $legacyStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($legacyShipped as $row) {
            $legacyShippedTotals['orders']++;
            $legacyShippedTotals['cartons'] += (int)($row['cartons_count'] ?? 0);
            $legacyShippedTotals['units']   += (int)($row['shipped_qty'] ?? 0);
        }
    }

    echo json_encode([

        'success' => true,

        'date' => $date,

        'pos' => $poSummary,

        'totals' => $totals,

        'legacy_shipped' => $legacyShipped,

        'legacy_shipped_totals' => $legacyShippedTotals,

    ]);



} catch (Exception $e) {

    http_response_code(400);

    echo json_encode([

        'success' => false,

        'message' => $e->getMessage()

    ]);

}


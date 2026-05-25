<?php

header('Content-Type: application/json');

header('Access-Control-Allow-Origin: *');

header('Access-Control-Allow-Methods: GET');

header('Access-Control-Allow-Headers: Content-Type');



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

            AND ({$receivedOnDateCx} OR cx.status = 'pending')

        )

        GROUP BY s.id, s.customer, s.internal_po_number

        HAVING cartons_entered_today > 0 OR cartons_pending > 0

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



    echo json_encode([

        'success' => true,

        'date' => $date,

        'pos' => $poSummary,

        'totals' => $totals

    ]);



} catch (Exception $e) {

    http_response_code(400);

    echo json_encode([

        'success' => false,

        'message' => $e->getMessage()

    ]);

}


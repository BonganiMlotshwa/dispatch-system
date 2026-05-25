<?php

/**

 * Goods Received Today Export — cartons that entered the warehouse on the given date.

 */



require_once '../config/database.php';

require_once '../includes/po_helpers.php';

require_once '../includes/csv_export.php';

require_once '../includes/carton_timestamps.php';



try {

    $pdo = getDbConnection();

    $date = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d');

    $receivedOnDate = cartonReceivedOnDateSql('c');



    $stmt = $pdo->prepare("

        SELECT 

            c.barcode_2d,

            c.po_number,

            s.internal_po_number,

            s.customer,

            c.size,

            c.units,

            c.entry_timestamp AS entry_time,

            c.status,

            c.scanned_by

        FROM cartons c

        INNER JOIN shipments s ON c.shipment_id = s.id

        WHERE {$receivedOnDate}

        ORDER BY c.entry_timestamp ASC

    ");

    $stmt->execute([$date]);

    $cartons = $stmt->fetchAll();



    $rows = [

        ['Goods Received — ' . $date],

        ['Date', $date, 'Total Cartons', count($cartons), 'Total Units', array_sum(array_column($cartons, 'units'))],

        [],

        ['Barcode', 'FTM PO', 'Customer PO', 'Customer', 'Size', 'Units', 'Entry Time', 'Current Status', 'Scanned By']

    ];



    foreach ($cartons as $carton) {

        $rows[] = [

            $carton['barcode_2d'],

            formatFtmInternalPo($carton['internal_po_number']),

            formatCustomerPoDisplay($carton['customer'] ?? '', $carton['po_number']),

            $carton['customer'],

            $carton['size'],

            $carton['units'],

            $carton['entry_time'] ? date('Y-m-d H:i:s', strtotime($carton['entry_time'])) : '',

            $carton['status'],

            $carton['scanned_by'] ?? ''

        ];

    }



    csvOutputRows('goods_received_' . $date . '.csv', $rows);



} catch (Exception $e) {

    http_response_code(400);

    echo 'Error: ' . $e->getMessage();

}


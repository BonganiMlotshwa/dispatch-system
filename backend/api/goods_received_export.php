<?php
/**
 * Goods Received Today Export
 */

require_once '../config/database.php';
require_once '../includes/po_helpers.php';
require_once '../includes/csv_export.php';

try {
    $pdo = getDbConnection();
    $date = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d');
    
    $stmt = $pdo->prepare("
        SELECT 
            c.barcode_2d,
            c.po_number,
            s.internal_po_number,
            s.customer,
            c.size,
            c.units,
            c.scan_timestamp,
            c.scanned_by
        FROM cartons c
        INNER JOIN shipments s ON c.shipment_id = s.id
        WHERE c.status = 'entered'
        AND DATE(c.scan_timestamp) = ?
        ORDER BY c.scan_timestamp ASC
    ");
    $stmt->execute([$date]);
    $cartons = $stmt->fetchAll();
    
    $rows = [
        ['Goods Received — ' . $date],
        ['Date', $date, 'Total Cartons', count($cartons), 'Total Units', array_sum(array_column($cartons, 'units'))],
        [],
        ['Barcode', 'FTM PO', 'Customer PO', 'Customer', 'Size', 'Units', 'Time Received', 'Scanned By']
    ];
    
    foreach ($cartons as $carton) {
        $rows[] = [
            $carton['barcode_2d'],
            formatFtmInternalPo($carton['internal_po_number']),
            formatCustomerPoDisplay($carton['customer'] ?? '', $carton['po_number']),
            $carton['customer'],
            $carton['size'],
            $carton['units'],
            date('H:i:s', strtotime($carton['scan_timestamp'])),
            $carton['scanned_by'] ?? ''
        ];
    }
    
    csvOutputRows('goods_received_' . $date . '.csv', $rows);
    
} catch (Exception $e) {
    http_response_code(400);
    echo 'Error: ' . $e->getMessage();
}

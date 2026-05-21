<?php
/**
 * Goods Received Today Export
 * Export all cartons received (entered) today in one column format
 */

header('Content-Type: text/csv');
header('Content-Disposition: attachment; filename="goods_received_' . date('Y-m-d') . '.csv"');

require_once '../config/database.php';

try {
    $pdo = getDbConnection();
    
    // Get date parameter or use today
    $date = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d');
    
    // Get all cartons entered on the specified date
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
    
    $output = fopen('php://output', 'w');
    
    // Summary info as column headers and values
    fputcsv($output, ['Date', 'Total Cartons', 'Total Units']);
    fputcsv($output, [
        $date,
        count($cartons),
        array_sum(array_column($cartons, 'units'))
    ]);
    fputcsv($output, []); // Empty row
    
    // Data table column headers
    fputcsv($output, ['Barcode', 'PO Number', 'Customer', 'Size', 'Units', 'Time Received', 'Scanned By']);
    
    // Data rows
    foreach ($cartons as $carton) {
        fputcsv($output, [
            $carton['barcode_2d'],
            $carton['internal_po_number'],
            $carton['customer'],
            $carton['size'],
            $carton['units'],
            date('H:i:s', strtotime($carton['scan_timestamp'])),
            $carton['scanned_by']
        ]);
    }
    
    fclose($output);
    
} catch (Exception $e) {
    http_response_code(400);
    echo 'Error: ' . $e->getMessage();
}

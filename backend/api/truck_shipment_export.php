<?php
require_once '../config/database.php';

try {
    $pdo = getDbConnection();
    
    if (!isset($_GET['id']) || !isset($_GET['format'])) {
        throw new Exception('Missing required parameters');
    }
    
    $id = (int)$_GET['id'];
    $format = $_GET['format'];
    
    // Get truck shipment details
    $stmt = $pdo->prepare("
        SELECT * FROM truck_shipments WHERE id = ?
    ");
    $stmt->execute([$id]);
    $shipment = $stmt->fetch();
    
    if (!$shipment) {
        throw new Exception('Truck shipment not found');
    }
    
    // Get items from truck_shipment_items (old method)
    $stmt = $pdo->prepare("
        SELECT tsi.*, s.internal_po_number, s.customer, s.style, s.color, s.order_qty
        FROM truck_shipment_items tsi
        INNER JOIN shipments s ON tsi.shipment_id = s.id
        WHERE tsi.truck_shipment_id = ?
        ORDER BY tsi.id
    ");
    $stmt->execute([$id]);
    $items = $stmt->fetchAll();
    
    // Get cartons linked directly to this truck (new method)
    $stmt = $pdo->prepare("
        SELECT 
            s.customer,
            s.internal_po_number,
            s.style,
            s.color,
            s.order_qty,
            COUNT(c.id) as cartons_shipped,
            SUM(CAST(c.units AS UNSIGNED)) as units_shipped
        FROM cartons c
        INNER JOIN shipments s ON c.shipment_id = s.id
        WHERE c.truck_shipment_id = ?
        GROUP BY s.id, s.customer, s.internal_po_number, s.style, s.color, s.order_qty
        ORDER BY s.customer, s.internal_po_number
    ");
    $stmt->execute([$id]);
    $directCartons = $stmt->fetchAll();
    
    // Merge both methods (prefer direct cartons if available)
    if (count($directCartons) > 0) {
        $items = $directCartons;
    }
    
    if ($format === 'csv') {
        // CSV Export - Match exact format from image
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="truck_shipment_' . $shipment['truck_reg'] . '_' . $shipment['shipment_date'] . '.csv"');
        
        $output = fopen('php://output', 'w');
        
        // Title
        fputcsv($output, ['Truck Shipment Summary']);
        
        // Truck info - each field on its own row
        fputcsv($output, ['Date', $shipment['shipment_date']]);
        fputcsv($output, ['Shipment Week', $shipment['shipment_week'] ?? '']);
        fputcsv($output, ['Truck Registration', $shipment['truck_reg']]);
        fputcsv($output, ['Driver', $shipment['driver_name'] ?? '']);
        fputcsv($output, ['Remarks', $shipment['remarks'] ?? '']);
        fputcsv($output, []); // Empty row
        
        // Data table column headers
        fputcsv($output, ['Customer', 'PO Number', 'Style', 'Color', 'Order Qty', 'Units Shipped', 'Total Cartons', 'Cartons Shipped']);
        
        // Data rows
        $totalCartons = 0;
        $totalUnits = 0;
        foreach ($items as $item) {
            fputcsv($output, [
                $item['customer'],
                $item['internal_po_number'],
                $item['style'] ?? '',
                $item['color'] ?? '',
                $item['order_qty'] ?? 0,
                $item['units_shipped'],
                '', // Total Cartons column (empty)
                $item['cartons_shipped']
            ]);
            $totalCartons += $item['cartons_shipped'];
            $totalUnits += $item['units_shipped'];
        }
        
        // Totals row
        fputcsv($output, []);
        fputcsv($output, ['Total', '', '', '', '', $totalUnits, '', $totalCartons]);
        
        fclose($output);
        exit;
    }
    elseif ($format === 'pdf') {
        // PDF Export (HTML for printing)
        header('Content-Type: text/html; charset=utf-8');
        
        $html = '<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Truck Shipment Summary - ' . htmlspecialchars($shipment['truck_reg']) . '</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                .info-table { width: 60%; margin-bottom: 20px; border-collapse: collapse; }
                .info-table th { width: 40%; background-color: #f2f2f2; border: 1px solid #ddd; padding: 8px; text-align: left; }
                .info-table td { width: 60%; border: 1px solid #ddd; padding: 8px; }
                .data-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                .data-table th, .data-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .data-table th { background-color: #4a5568; color: white; }
                .total-row { background-color: #e2e8f0; font-weight: bold; }
                .footer { text-align: center; margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>FTM Garments Warehouse</h1>
                <h2>Truck Shipment Summary</h2>
            </div>
            
            <table class="info-table">
                <tr><th>Date</th><td>' . htmlspecialchars($shipment['shipment_date']) . '</td></tr>
                <tr><th>Shipment Week</th><td>' . htmlspecialchars($shipment['shipment_week'] ?? '-') . '</td></tr>
                <tr><th>Truck Registration</th><td>' . htmlspecialchars($shipment['truck_reg']) . '</td></tr>
                <tr><th>Driver</th><td>' . htmlspecialchars($shipment['driver_name'] ?? '-') . '</td></tr>
                <tr><th>Remarks</th><td>' . htmlspecialchars($shipment['remarks'] ?? '-') . '</td></tr>
            </table>
            
            <h3>Shipment Details</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Customer</th>
                        <th>PO Number</th>
                        <th>Style</th>
                        <th>Color</th>
                        <th>Order Qty</th>
                        <th>Units Shipped</th>
                        <th>Cartons Shipped</th>
                    </tr>
                </thead>
                <tbody>';
        
        $totalCartons = 0;
        $totalUnits = 0;
        foreach ($items as $item) {
            $html .= '<tr>
                <td>' . htmlspecialchars($item['customer']) . '</td>
                <td>' . htmlspecialchars($item['internal_po_number']) . '</td>
                <td>' . htmlspecialchars($item['style'] ?? '-') . '</td>
                <td>' . htmlspecialchars($item['color'] ?? '-') . '</td>
                <td>' . number_format($item['order_qty'] ?? 0) . '</td>
                <td>' . number_format($item['units_shipped']) . '</td>
                <td>' . number_format($item['cartons_shipped']) . '</td>
            </tr>';
            $totalCartons += $item['cartons_shipped'];
            $totalUnits += $item['units_shipped'];
        }
        
        $html .= '<tr class="total-row">
                <td colspan="5">Total</td>
                <td>' . number_format($totalUnits) . '</td>
                <td>' . number_format($totalCartons) . '</td>
            </tr>
                </tbody>
            </table>
            
            <div class="footer">
                <p>Generated on ' . date('Y-m-d H:i:s') . '</p>
                <p>&copy; ' . date('Y') . ' FTM Garments Warehouse - All Rights Reserved</p>
            </div>
        </body>
        </html>';
        
        echo $html;
        exit;
    }
    
} catch (Exception $e) {
    http_response_code(400);
    echo 'Error: ' . $e->getMessage();
}

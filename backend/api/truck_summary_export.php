<?php
/**
 * Truck Summary Export — full report (all trucks matching filters) as CSV or PDF (print HTML).
 */

require_once '../config/database.php';
require_once '../includes/csv_export.php';

try {
    $pdo = getDbConnection();

    $format = isset($_GET['format']) ? strtolower(trim($_GET['format'])) : 'csv';
    if (!in_array($format, ['csv', 'pdf'], true)) {
        throw new Exception('Invalid format. Use csv or pdf.');
    }

    $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
    $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;
    $week = isset($_GET['week']) ? $_GET['week'] : null;
    $truckReg = isset($_GET['truck_reg']) ? trim($_GET['truck_reg']) : null;

    $whereConditions = [];
    $params = [];

    if ($startDate && $endDate) {
        $whereConditions[] = 'ts.shipment_date BETWEEN ? AND ?';
        $params[] = $startDate;
        $params[] = $endDate;
    } elseif ($startDate) {
        $whereConditions[] = 'ts.shipment_date >= ?';
        $params[] = $startDate;
    } elseif ($endDate) {
        $whereConditions[] = 'ts.shipment_date <= ?';
        $params[] = $endDate;
    }

    if ($week) {
        $whereConditions[] = 'ts.shipment_week = ?';
        $params[] = $week;
    }

    if ($truckReg !== null && $truckReg !== '') {
        $whereConditions[] = 'ts.truck_reg LIKE ?';
        $params[] = '%' . $truckReg . '%';
    }

    $whereClause = count($whereConditions) > 0 ? 'WHERE ' . implode(' AND ', $whereConditions) : '';

    $sql = "
        SELECT
            ts.shipment_date,
            ts.shipment_week,
            ts.truck_reg,
            ts.driver_name,
            ts.remarks,
            COUNT(DISTINCT c.id) as total_cartons,
            COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as total_units,
            COUNT(DISTINCT c.shipment_id) as total_pos,
            GROUP_CONCAT(DISTINCT s.customer ORDER BY s.customer SEPARATOR ', ') as customers,
            MIN(c.exit_timestamp) as first_scan_out_time,
            MAX(c.exit_timestamp) as last_scan_out_time
        FROM truck_shipments ts
        LEFT JOIN cartons c ON c.truck_shipment_id = ts.id
        LEFT JOIN shipments s ON c.shipment_id = s.id
        {$whereClause}
        GROUP BY ts.id, ts.shipment_date, ts.shipment_week, ts.truck_reg, ts.driver_name, ts.remarks, ts.created_at
        ORDER BY ts.shipment_date DESC, ts.created_at DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $trucks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalTrucks = count($trucks);
    $totalCartons = array_sum(array_column($trucks, 'total_cartons'));
    $totalUnits = array_sum(array_column($trucks, 'total_units'));

    $filterParts = [];
    if ($startDate) {
        $filterParts[] = 'From ' . htmlspecialchars($startDate);
    }
    if ($endDate) {
        $filterParts[] = 'To ' . htmlspecialchars($endDate);
    }
    if ($week) {
        $filterParts[] = 'Week ' . htmlspecialchars($week);
    }
    if ($truckReg) {
        $filterParts[] = 'Truck ' . htmlspecialchars($truckReg);
    }
    $filterLabel = count($filterParts) > 0 ? implode(' · ', $filterParts) : 'All trucks';

    if ($format === 'csv') {
        $rows = [[
            'Truck Summary Report',
            date('Y-m-d H:i:s'),
            $filterLabel
        ], []];
        $rows[] = [
            'Date',
            'Shipment Week',
            'Truck Registration',
            'Driver',
            'Customers',
            'Total POs',
            'Total Cartons',
            'Total Units',
            'First Scan Out Time',
            'Last Scan Out Time',
            'Remarks'
        ];

        foreach ($trucks as $truck) {
            $rows[] = [
                $truck['shipment_date'],
                $truck['shipment_week'] ?? '',
                $truck['truck_reg'],
                $truck['driver_name'] ?? '',
                $truck['customers'] ?? '',
                $truck['total_pos'],
                $truck['total_cartons'],
                $truck['total_units'],
                $truck['first_scan_out_time'] ?? '',
                $truck['last_scan_out_time'] ?? '',
                $truck['remarks'] ?? ''
            ];
        }

        $rows[] = [];
        $rows[] = ['Summary', '', '', '', '', '', $totalTrucks . ' trucks', $totalCartons, $totalUnits, '', '', ''];

        csvOutputRows('truck_summary_' . date('Y-m-d') . '.csv', $rows);
    }

    header('Content-Type: text/html; charset=utf-8');

    $rowsHtml = '';
    foreach ($trucks as $truck) {
        $rowsHtml .= '<tr>
            <td>' . htmlspecialchars($truck['shipment_date']) . '</td>
            <td>' . htmlspecialchars($truck['shipment_week'] ?? '-') . '</td>
            <td>' . htmlspecialchars($truck['truck_reg']) . '</td>
            <td>' . htmlspecialchars($truck['driver_name'] ?? '-') . '</td>
            <td>' . htmlspecialchars($truck['customers'] ?? '-') . '</td>
            <td class="num">' . (int)$truck['total_pos'] . '</td>
            <td class="num">' . number_format((int)$truck['total_cartons']) . '</td>
            <td class="num">' . number_format((int)$truck['total_units']) . '</td>
            <td>' . htmlspecialchars($truck['first_scan_out_time'] ?? '-') . '</td>
            <td>' . htmlspecialchars($truck['last_scan_out_time'] ?? '-') . '</td>
            <td>' . htmlspecialchars($truck['remarks'] ?? '') . '</td>
        </tr>';
    }

    echo '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Truck Summary Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .meta { text-align: center; color: #666; margin-bottom: 20px; }
        .summary-cards { display: flex; gap: 16px; justify-content: center; margin-bottom: 24px; flex-wrap: wrap; }
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px 20px; min-width: 120px; text-align: center; }
        .card strong { display: block; font-size: 22px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #4a5568; color: #fff; }
        tr:nth-child(even) { background: #f8f9fa; }
        .num { text-align: right; }
        .total-row { background: #e2e8f0 !important; font-weight: bold; }
        .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #666; }
        @media print { body { margin: 0; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>FTM Garments Warehouse</h1>
        <h2>Truck Summary Report</h2>
    </div>
    <div class="meta">' . $filterLabel . ' · Generated ' . date('Y-m-d H:i:s') . '</div>
    <div class="summary-cards">
        <div class="card"><span>Total Trucks</span><strong>' . $totalTrucks . '</strong></div>
        <div class="card"><span>Total Cartons</span><strong>' . number_format($totalCartons) . '</strong></div>
        <div class="card"><span>Total Units</span><strong>' . number_format($totalUnits) . '</strong></div>
    </div>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Week</th>
                <th>Truck Reg</th>
                <th>Driver</th>
                <th>Customers</th>
                <th class="num">POs</th>
                <th class="num">Cartons</th>
                <th class="num">Units</th>
                <th>First Scan Out</th>
                <th>Last Scan Out</th>
                <th>Remarks</th>
            </tr>
        </thead>
        <tbody>' . $rowsHtml . '
            <tr class="total-row">
                <td colspan="6">Totals</td>
                <td class="num">' . number_format($totalCartons) . '</td>
                <td class="num">' . number_format($totalUnits) . '</td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
        </tbody>
    </table>
    <div class="footer">
        <p>&copy; ' . date('Y') . ' FTM Garments Warehouse</p>
    </div>
    <script>window.onload = function() { window.print(); };</script>
</body>
</html>';
    exit;

} catch (Exception $e) {
    http_response_code(400);
    echo 'Error: ' . $e->getMessage();
}

<?php
/**
 * Reports Utility
 * 
 * This file contains functions for generating reports and dashboard data.
 */

// Define constants for PDF generation
define('PDF_MARGIN', 10);
define('PDF_LINE_HEIGHT', 6);

/**
 * Get dashboard summary data
 * 
 * @param PDO $pdo Database connection
 * @return array Dashboard summary data
 */
function getDashboardSummary($pdo) {
    try {
        $summary = [];
        
        // Total shipments
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM shipments");
        $summary['total_shipments'] = $stmt->fetch()['total'];
        
        // Total cartons
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM cartons");
        $summary['total_cartons'] = $stmt->fetch()['total'];
        
        // Cartons by status
        $stmt = $pdo->query("SELECT status, COUNT(*) as count FROM cartons GROUP BY status");
        $statusCounts = [];
        while ($row = $stmt->fetch()) {
            $statusCounts[$row['status']] = $row['count'];
        }
        
        $summary['cartons_pending'] = $statusCounts['pending'] ?? 0;
        $summary['cartons_entered'] = $statusCounts['entered'] ?? 0;
        $summary['cartons_exited'] = $statusCounts['exited'] ?? 0;
        
        // Cartons missing QC/Finishing numbers
        $stmt = $pdo->query("SELECT 
            COUNT(CASE WHEN qc_number IS NULL THEN 1 END) as missing_qc,
            COUNT(CASE WHEN finishing_number IS NULL THEN 1 END) as missing_finishing
            FROM cartons");
        $missingData = $stmt->fetch();
        
        $summary['cartons_missing_qc'] = $missingData['missing_qc'];
        $summary['cartons_missing_finishing'] = $missingData['missing_finishing'];
        
        // Recent shipments
        $stmt = $pdo->query("SELECT id, internal_po_number, file_name, import_date 
                           FROM shipments 
                           ORDER BY import_date DESC 
                           LIMIT 5");
        $summary['recent_shipments'] = $stmt->fetchAll();
        
        return [
            'success' => true,
            'summary' => $summary
        ];
        
    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

/**
 * Get shipment details with carton summary
 * 
 * @param int $shipmentId Shipment ID
 * @param PDO $pdo Database connection
 * @return array Shipment details with carton summary
 */
function getShipmentDetails($shipmentId, $pdo) {
    try {
        // Get shipment data
        $stmt = $pdo->prepare("SELECT * FROM shipments WHERE id = ?");
        $stmt->execute([$shipmentId]);
        $shipment = $stmt->fetch();
        
        if (!$shipment) {
            return [
                'success' => false,
                'message' => 'Shipment not found'
            ];
        }
        
        // Get carton summary for this shipment
        $stmt = $pdo->prepare("SELECT 
            COUNT(*) as total_cartons,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
            COUNT(CASE WHEN status = 'entered' THEN 1 END) as entered,
            COUNT(CASE WHEN status = 'exited' THEN 1 END) as exited,
            COUNT(CASE WHEN qc_number IS NULL THEN 1 END) as missing_qc,
            COUNT(CASE WHEN finishing_number IS NULL THEN 1 END) as missing_finishing
            FROM cartons 
            WHERE shipment_id = ?");
        $stmt->execute([$shipmentId]);
        $summary = $stmt->fetch();
        
        return [
            'success' => true,
            'shipment' => $shipment,
            'summary' => $summary
        ];
        
    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

/**
 * Get cartons for a specific shipment with optional filters
 * 
 * @param int $shipmentId Shipment ID
 * @param array $filters Optional filters (status, size, etc.)
 * @param PDO $pdo Database connection
 * @return array List of cartons
 */
function getShipmentCartons($shipmentId, $filters = [], $pdo) {
    try {
        $sql = "SELECT * FROM cartons WHERE shipment_id = ?";
        $params = [$shipmentId];
        
        // Apply filters if provided
        if (!empty($filters)) {
            foreach ($filters as $field => $value) {
                if (in_array($field, ['status', 'size', 'qc_number', 'finishing_number']) && $value !== '') {
                    $sql .= " AND $field = ?";
                    $params[] = $value;
                }
            }
        }
        
        $sql .= " ORDER BY id ASC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $cartons = $stmt->fetchAll();
        
        return [
            'success' => true,
            'cartons' => $cartons,
            'count' => count($cartons)
        ];
        
    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

/**
 * Generate CSV report for a shipment
 * 
 * @param int $shipmentId Shipment ID
 * @param PDO $pdo Database connection
 * @return array CSV data or error message
 */
function generateShipmentCsvReport($shipmentId, $pdo) {
    try {
        // Get shipment details with customer info
        $stmt = $pdo->prepare("SELECT internal_po_number, customer, style, color, order_qty, entry_type FROM shipments WHERE id = ?");
        $stmt->execute([$shipmentId]);
        $shipment = $stmt->fetch();
        
        if (!$shipment) {
            return [
                'success' => false,
                'message' => 'Shipment not found'
            ];
        }
        
        // Get all cartons for this shipment
        $stmt = $pdo->prepare("SELECT * FROM cartons WHERE shipment_id = ? ORDER BY id ASC");
        $stmt->execute([$shipmentId]);
        $cartons = $stmt->fetchAll();
        
        if (empty($cartons)) {
            return [
                'success' => false,
                'message' => 'No cartons found for this shipment'
            ];
        }
        
        // Generate CSV content
        $csvData = [];
        
        // Add header row with new fields
        $csvData[] = [
            'Customer', 'FTM PO', 'Style', 'Color', 'Barcode', 'PO Number', 'Size', 'Units', 'Item',
            'QC Number', 'Finishing Number', 'Status', 'Scan Timestamp', 'Notes'
        ];
        
        // Add data rows
        foreach ($cartons as $carton) {
            $csvData[] = [
                $shipment['customer'] ?? 'MRP',
                $shipment['internal_po_number'],
                $shipment['style'] ?? '',
                $shipment['color'] ?? '',
                $carton['barcode_2d'],
                $carton['po_number'],
                $carton['size'],
                $carton['units'],
                $carton['item'],
                $carton['qc_number'] ?? '',
                $carton['finishing_number'] ?? '',
                $carton['status'],
                $carton['scan_timestamp'] ?? '',
                $carton['notes'] ?? ''
            ];
        }
        
        return [
            'success' => true,
            'filename' => 'shipment_' . $shipmentId . '_' . date('Y-m-d') . '.csv',
            'data' => $csvData
        ];
        
    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

/**
 * Generate PDF report for a shipment
 *
 * @param int $shipmentId Shipment ID
 * @param PDO $pdo Database connection
 * @return array PDF data or error message
 */
function generateShipmentPdfReport($shipmentId, $pdo) {
    try {
        // Get shipment details
        $stmt = $pdo->prepare("SELECT * FROM shipments WHERE id = ?");
        $stmt->execute([$shipmentId]);
        $shipment = $stmt->fetch();

        if (!$shipment) {
            return [
                'success' => false,
                'message' => 'Shipment not found'
            ];
        }

        // Get carton summary for this shipment
        $stmt = $pdo->prepare("SELECT
            COUNT(*) as total_cartons,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
            COUNT(CASE WHEN status = 'entered' THEN 1 END) as entered,
            COUNT(CASE WHEN status = 'exited' THEN 1 END) as exited,
            COUNT(CASE WHEN qc_number IS NULL THEN 1 END) as missing_qc,
            COUNT(CASE WHEN finishing_number IS NULL THEN 1 END) as missing_finishing
            FROM cartons
            WHERE shipment_id = ?");
        $stmt->execute([$shipmentId]);
        $summary = $stmt->fetch();

        // Get all cartons for this shipment
        $stmt = $pdo->prepare("SELECT * FROM cartons WHERE shipment_id = ? ORDER BY id ASC");
        $stmt->execute([$shipmentId]);
        $cartons = $stmt->fetchAll();

        if (empty($cartons)) {
            return [
                'success' => false,
                'message' => 'No cartons found for this shipment'
            ];
        }

        // Start PDF content generation
        ob_start();

        // PDF Header
        echo "<html><head>";
        echo "<style>";
        echo "body { font-family: Arial, sans-serif; margin: 20px; padding: 0; }";
        echo "h1 { font-size: 18px; color: #333; margin-bottom: 5px; }";
        echo "h2 { font-size: 16px; color: #555; margin-top: 20px; margin-bottom: 10px; }";
        echo "table { border-collapse: collapse; margin: 10px 0; }";
        echo "table.info-table { width: 60%; }";
        echo "table.info-table th { width: 40%; background-color: #f2f2f2; border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold; }";
        echo "table.info-table td { width: 60%; border: 1px solid #ddd; padding: 8px; text-align: left; }";
        echo "table.details-table { width: 100%; }";
        echo "table.details-table th, table.details-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }";
        echo "table.details-table th { background-color: #f2f2f2; font-weight: bold; }";
        echo ".header { text-align: center; margin-bottom: 20px; }";
        echo ".footer { text-align: center; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; }";
        echo "</style>";
        echo "</head><body>";

        // Report Header
        echo "<div class='header'>";
        echo "<h1>Warehouse Carton Tracking System</h1>";
        echo "<h2>Shipment Report</h2>";
        echo "<p>Generated on: " . date('Y-m-d H:i:s') . "</p>";
        echo "</div>";

        // Shipment Information
        echo "<h2>Shipment Information</h2>";
        echo "<table class='info-table'>";
        echo "<tr><th>FTM PO</th><td>{$shipment['internal_po_number']}</td></tr>";
        echo "<tr><th>File Name</th><td>{$shipment['file_name']}</td></tr>";
        echo "<tr><th>Import Date</th><td>{$shipment['import_date']}</td></tr>";
        echo "</table>";

        // Carton Summary
        echo "<h2>Carton Summary</h2>";
        echo "<table class='info-table'>";
        echo "<tr><th>Total Cartons</th><td>{$summary['total_cartons']}</td></tr>";
        echo "<tr><th>Pending</th><td>{$summary['pending']}</td></tr>";
        echo "<tr><th>In Warehouse</th><td>{$summary['entered']}</td></tr>";
        echo "<tr><th>Shipped</th><td>{$summary['exited']}</td></tr>";
        echo "<tr><th>Missing QC Number</th><td>{$summary['missing_qc']}</td></tr>";
        echo "<tr><th>Missing Finishing Number</th><td>{$summary['missing_finishing']}</td></tr>";
        echo "</table>";

        // Carton Details
        echo "<h2>Carton Details</h2>";
        echo "<table class='details-table'>";
        echo "<tr>";
        echo "<th>Barcode</th>";
        echo "<th>PO Number</th>";
        echo "<th>Size</th>";
        echo "<th>Units</th>";
        echo "<th>Status</th>";
        echo "<th>QC Number</th>";
        echo "<th>Finishing Number</th>";
        echo "</tr>";

        foreach ($cartons as $carton) {
            echo "<tr>";
            echo "<td>{$carton['barcode_2d']}</td>";
            echo "<td>{$carton['po_number']}</td>";
            echo "<td>{$carton['size']}</td>";
            echo "<td>{$carton['units']}</td>";
            echo "<td>{$carton['status']}</td>";
            echo "<td>{$carton['qc_number']}</td>";
            echo "<td>{$carton['finishing_number']}</td>";
            echo "</tr>";
        }

        echo "</table>";

        // Footer
        echo "<div class='footer'>";
        echo "<p>Warehouse Carton Tracking System &copy; " . date('Y') . "</p>";
        echo "</div>";

        echo "</body></html>";

        $html = ob_get_clean();

        return [
            'success' => true,
            'filename' => 'shipment_' . $shipmentId . '_' . date('Y-m-d') . '.pdf',
            'html' => $html
        ];

    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

/**
 * Get comprehensive reports with time-based filtering
 *
 * @param PDO $pdo Database connection
 * @param string $period Time period (daily, weekly, monthly, yearly, all)
 * @param string $startDate Custom start date (optional)
 * @param string $endDate Custom end date (optional)
 * @return array Comprehensive report data
 */
function getComprehensiveReports($pdo, $period = 'all', $startDate = null, $endDate = null, $customer = null) {
    try {
        // Customer filter condition
        $customerCondition = "";
        $customerParams = [];
        
        if ($customer && $customer !== 'all') {
            $customerCondition = " AND s.customer = ?";
            $customerParams = [$customer];
        }
        
        // Determine date range based on period for scan_timestamp
        $dateCondition = "";
        $params = [];

        if ($startDate && $endDate) {
            $dateCondition = " AND DATE(c.scan_timestamp) BETWEEN ? AND ?";
            $params = array_merge($customerParams, [$startDate, $endDate]);
        } elseif ($period !== 'all') {
            switch ($period) {
                case 'daily':
                    $dateCondition = " AND DATE(c.scan_timestamp) = CURDATE()";
                    break;
                case 'weekly':
                    $dateCondition = " AND YEARWEEK(c.scan_timestamp, 1) = YEARWEEK(CURDATE(), 1)";
                    break;
                case 'monthly':
                    $dateCondition = " AND DATE_FORMAT(c.scan_timestamp, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')";
                    break;
                case 'yearly':
                    $dateCondition = " AND YEAR(c.scan_timestamp) = YEAR(CURDATE())";
                    break;
            }
            $params = $customerParams;
        } else {
            $params = $customerParams;
        }

        // Determine date range based on period for import_date (for top orders)
        $importDateCondition = "";
        $importParams = [];

        if ($startDate && $endDate) {
            $importDateCondition = " WHERE DATE(s.import_date) BETWEEN ? AND ?";
            $importParams = [$startDate, $endDate];
        } elseif ($period !== 'all') {
            switch ($period) {
                case 'daily':
                    $importDateCondition = " WHERE DATE(s.import_date) = CURDATE()";
                    break;
                case 'weekly':
                    $importDateCondition = " WHERE YEARWEEK(s.import_date, 1) = YEARWEEK(CURDATE(), 1)";
                    break;
                case 'monthly':
                    $importDateCondition = " WHERE DATE_FORMAT(s.import_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')";
                    break;
                case 'yearly':
                    $importDateCondition = " WHERE YEAR(s.import_date) = YEAR(CURDATE())";
                    break;
            }
        }
        
        // Add customer filter to import date condition
        if ($customer && $customer !== 'all') {
            if ($importDateCondition) {
                $importDateCondition .= " AND s.customer = ?";
            } else {
                $importDateCondition = " WHERE s.customer = ?";
            }
            $importParams[] = $customer;
        }

        // Get cartons entered (status changed to 'entered')
        // Orders Entered = count of distinct POs that have at least one carton with status='entered'
        $stmt = $pdo->prepare("
            SELECT
                COUNT(*) as cartons_entered,
                COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as units_entered
            FROM cartons c
            JOIN shipments s ON c.shipment_id = s.id
            WHERE c.status = 'entered' {$customerCondition} {$dateCondition}
        ");
        $stmt->execute($params);
        $entered = $stmt->fetch();
        
        // Count distinct orders with entered cartons (no date filter for order count)
        $customerFilterForOrders = $customer && $customer !== 'all' ? " AND s.customer = ?" : "";
        $orderParams = $customer && $customer !== 'all' ? [$customer] : [];
        
        $stmt = $pdo->prepare("
            SELECT COUNT(DISTINCT s.internal_po_number) as orders_entered
            FROM cartons c
            JOIN shipments s ON c.shipment_id = s.id
            WHERE c.status = 'entered' {$customerFilterForOrders}
        ");
        $stmt->execute($orderParams);
        $ordersEntered = $stmt->fetch()['orders_entered'];

        // Get cartons shipped (status changed to 'exited')
        // Orders Shipped = count of distinct POs that have at least one carton with status='exited'
        $stmt = $pdo->prepare("
            SELECT
                COUNT(*) as cartons_shipped,
                COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as units_shipped
            FROM cartons c
            JOIN shipments s ON c.shipment_id = s.id
            WHERE c.status = 'exited' {$customerCondition} {$dateCondition}
        ");
        $stmt->execute($params);
        $shipped = $stmt->fetch();
        
        // Count distinct orders with shipped cartons (no date filter for order count)
        $stmt = $pdo->prepare("
            SELECT COUNT(DISTINCT s.internal_po_number) as orders_shipped
            FROM cartons c
            JOIN shipments s ON c.shipment_id = s.id
            WHERE c.status = 'exited' {$customerFilterForOrders}
        ");
        $stmt->execute($orderParams);
        $ordersShipped = $stmt->fetch()['orders_shipped'];

        // Get current warehouse inventory
        $stmt = $pdo->prepare("
            SELECT
                COUNT(*) as cartons_in_warehouse,
                COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as units_in_warehouse,
                COUNT(DISTINCT s.internal_po_number) as orders_in_warehouse
            FROM cartons c
            JOIN shipments s ON c.shipment_id = s.id
            WHERE c.status = 'entered' {$customerFilterForOrders}
        ");
        $stmt->execute($orderParams);
        $warehouse = $stmt->fetch();

        // Get all orders summary
        $stmt = $pdo->prepare("
            SELECT
                COUNT(DISTINCT s.internal_po_number) as total_orders,
                COUNT(DISTINCT CASE WHEN c.status IN ('entered', 'exited') THEN s.internal_po_number END) as active_orders,
                COUNT(DISTINCT CASE WHEN c.status = 'entered' THEN s.internal_po_number END) as orders_with_stock
            FROM shipments s
            LEFT JOIN cartons c ON s.id = c.shipment_id
            WHERE 1=1 {$customerFilterForOrders}
        ");
        $stmt->execute($orderParams);
        $orders = $stmt->fetch();
        
        // Get total cartons from imports (all cartons regardless of status)
        $stmt = $pdo->prepare("
            SELECT
                COUNT(*) as total_cartons,
                COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as total_units
            FROM cartons c
            JOIN shipments s ON c.shipment_id = s.id
            {$importDateCondition}
        ");
        $stmt->execute($importParams);
        $totals = $stmt->fetch();

        // Get top orders by carton count (filtered by import date)
        $topOrdersQuery = "
            SELECT
                s.customer,
                s.internal_po_number as ftm_po,
                COUNT(c.id) as carton_count,
                COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as total_units,
                COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as cartons_pending,
                COALESCE(SUM(CASE WHEN c.status = 'pending' THEN CAST(c.units AS UNSIGNED) ELSE 0 END), 0) as units_pending,
                COUNT(CASE WHEN c.status = 'entered' THEN 1 END) as cartons_in_warehouse,
                COUNT(CASE WHEN c.status = 'exited' THEN 1 END) as cartons_shipped
            FROM shipments s
            LEFT JOIN cartons c ON s.id = c.shipment_id
            {$importDateCondition}
            GROUP BY s.id, s.customer, s.internal_po_number
            ORDER BY carton_count DESC
            LIMIT 10
        ";
        $stmt = $pdo->prepare($topOrdersQuery);
        $stmt->execute($importParams);
        $topOrders = $stmt->fetchAll();

        return [
            'success' => true,
            'period' => $period,
            'customer' => $customer,
            'date_range' => $startDate && $endDate ? ['start' => $startDate, 'end' => $endDate] : null,
            'summary' => [
                'total_cartons' => (int)$totals['total_cartons'],
                'total_units' => (int)$totals['total_units'],
                'cartons_entered' => (int)$entered['cartons_entered'],
                'units_entered' => (int)$entered['units_entered'],
                'orders_entered' => (int)$ordersEntered,
                'cartons_shipped' => (int)$shipped['cartons_shipped'],
                'units_shipped' => (int)$shipped['units_shipped'],
                'orders_shipped' => (int)$ordersShipped,
                'cartons_in_warehouse' => (int)$warehouse['cartons_in_warehouse'],
                'units_in_warehouse' => (int)$warehouse['units_in_warehouse'],
                'orders_in_warehouse' => (int)$warehouse['orders_in_warehouse'],
                'total_orders' => (int)$orders['total_orders'],
                'active_orders' => (int)$orders['active_orders'],
                'orders_with_stock' => (int)$orders['orders_with_stock']
            ],
            'top_orders' => $topOrders,
            'generated_at' => date('Y-m-d H:i:s')
        ];

    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

/**
 * Get warehouse inventory report
 *
 * @param PDO $pdo Database connection
 * @return array Warehouse inventory data
 */
function getWarehouseInventory($pdo) {
    try {
        // Get warehouse inventory grouped by FTM PO with proper days calculation
        // Include all shipments that have at least one carton entered (in warehouse)
        $stmt = $pdo->prepare("
            SELECT
                s.customer,
                s.internal_po_number as ftm_po,
                s.file_name,
                s.import_date,
                COUNT(c.id) as total_cartons,
                COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as total_units,
                COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as cartons_pending,
                COALESCE(SUM(CASE WHEN c.status = 'pending' THEN CAST(c.units AS UNSIGNED) ELSE 0 END), 0) as units_pending,
                MAX(DATEDIFF(CURDATE(), DATE(COALESCE(c.created_at, s.import_date)))) as oldest_carton_days,
                MIN(DATEDIFF(CURDATE(), DATE(COALESCE(c.created_at, s.import_date)))) as newest_carton_days,
                AVG(DATEDIFF(CURDATE(), DATE(COALESCE(c.created_at, s.import_date)))) as avg_carton_days
            FROM shipments s
            INNER JOIN cartons c ON c.shipment_id = s.id
            WHERE s.id IN (
                SELECT DISTINCT shipment_id 
                FROM cartons 
                WHERE status = 'entered'
            )
            GROUP BY s.id, s.customer, s.internal_po_number, s.file_name, s.import_date
            ORDER BY s.customer ASC, oldest_carton_days DESC
        ");
        $stmt->execute();
        $inventory = $stmt->fetchAll();

        // Get total counts and overall age statistics
        $stmt = $pdo->prepare("
            SELECT 
                COUNT(*) as total_cartons,
                MAX(DATEDIFF(CURDATE(), DATE(COALESCE(c.created_at, s.import_date)))) as max_days_in_warehouse,
                MIN(DATEDIFF(CURDATE(), DATE(COALESCE(c.created_at, s.import_date)))) as min_days_in_warehouse,
                AVG(DATEDIFF(CURDATE(), DATE(COALESCE(c.created_at, s.import_date)))) as avg_days_in_warehouse
            FROM cartons c
            JOIN shipments s ON c.shipment_id = s.id
            WHERE c.status = 'entered'
        ");
        $stmt->execute();
        $totals = $stmt->fetch();

        return [
            'success' => true,
            'inventory' => $inventory,
            'total_cartons' => (int)$totals['total_cartons'],
            'total_orders' => count($inventory),
            'max_days_in_warehouse' => (int)$totals['max_days_in_warehouse'],
            'min_days_in_warehouse' => (int)$totals['min_days_in_warehouse'],
            'avg_days_in_warehouse' => round($totals['avg_days_in_warehouse'], 1),
            'generated_at' => date('Y-m-d H:i:s')
        ];

    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

/**
 * Get time-based reports
 *
 * @param PDO $pdo Database connection
 * @param string $period Time period (daily, weekly, monthly, yearly)
 * @return array Time-based report data
 */
function getTimeBasedReports($pdo, $period = 'daily', $startDate = null, $endDate = null, $filterPeriod = null) {
    try {
        $reports = [];

        // Build WHERE clause based on whether a custom date range is provided
        if ($startDate && $endDate) {
            $whereClause = "WHERE DATE(s.import_date) BETWEEN ? AND ?";
            $params = [$startDate, $endDate];
        } elseif ($filterPeriod && $filterPeriod !== 'all') {
            switch ($filterPeriod) {
                case 'daily':
                    $whereClause = "WHERE DATE(s.import_date) = CURDATE()";
                    break;
                case 'weekly':
                    $whereClause = "WHERE YEARWEEK(s.import_date, 1) = YEARWEEK(CURDATE(), 1)";
                    break;
                case 'monthly':
                    $whereClause = "WHERE DATE_FORMAT(s.import_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')";
                    break;
                case 'yearly':
                    $whereClause = "WHERE YEAR(s.import_date) = YEAR(CURDATE())";
                    break;
                default:
                    $whereClause = "";
            }
            $params = [];
        } else {
            $defaultIntervals = [
                'daily'   => '30 DAY',
                'weekly'  => '12 WEEK',
                'monthly' => '12 MONTH',
                'yearly'  => '5 YEAR',
            ];
            $interval = $defaultIntervals[$period] ?? '30 DAY';
            $whereClause = "WHERE s.import_date >= DATE_SUB(CURDATE(), INTERVAL {$interval})";
            $params = [];
        }

        switch ($period) {
            case 'daily':
                $sql = "
                    SELECT
                        DATE(s.import_date) as date,
                        s.customer,
                        s.internal_po_number as po_number,
                        COUNT(c.id) as cartons_received,
                        COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as units_received,
                        COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as cartons_pending,
                        COALESCE(SUM(CASE WHEN c.status = 'pending' THEN CAST(c.units AS UNSIGNED) ELSE 0 END), 0) as units_pending,
                        COUNT(CASE WHEN c.status = 'entered' THEN 1 END) as cartons_entered,
                        COUNT(CASE WHEN c.status = 'exited' THEN 1 END) as cartons_shipped
                    FROM shipments s
                    LEFT JOIN cartons c ON s.id = c.shipment_id
                    {$whereClause}
                    GROUP BY DATE(s.import_date), s.customer, s.internal_po_number
                    ORDER BY date DESC, s.customer ASC, s.internal_po_number ASC
                ";
                break;

            case 'weekly':
                $sql = "
                    SELECT
                        DATE_FORMAT(s.import_date, '%Y-%U') as week,
                        MIN(DATE(s.import_date)) as week_start,
                        s.customer,
                        s.internal_po_number as po_number,
                        COUNT(c.id) as cartons_received,
                        COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as units_received,
                        COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as cartons_pending,
                        COALESCE(SUM(CASE WHEN c.status = 'pending' THEN CAST(c.units AS UNSIGNED) ELSE 0 END), 0) as units_pending,
                        COUNT(CASE WHEN c.status = 'entered' THEN 1 END) as cartons_entered,
                        COUNT(CASE WHEN c.status = 'exited' THEN 1 END) as cartons_shipped
                    FROM shipments s
                    LEFT JOIN cartons c ON s.id = c.shipment_id
                    {$whereClause}
                    GROUP BY DATE_FORMAT(s.import_date, '%Y-%U'), s.customer, s.internal_po_number
                    ORDER BY week DESC, s.customer ASC, s.internal_po_number ASC
                ";
                break;

            case 'monthly':
                $sql = "
                    SELECT
                        DATE_FORMAT(s.import_date, '%Y-%m') as month,
                        s.customer,
                        s.internal_po_number as po_number,
                        COUNT(c.id) as cartons_received,
                        COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as units_received,
                        COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as cartons_pending,
                        COALESCE(SUM(CASE WHEN c.status = 'pending' THEN CAST(c.units AS UNSIGNED) ELSE 0 END), 0) as units_pending,
                        COUNT(CASE WHEN c.status = 'entered' THEN 1 END) as cartons_entered,
                        COUNT(CASE WHEN c.status = 'exited' THEN 1 END) as cartons_shipped
                    FROM shipments s
                    LEFT JOIN cartons c ON s.id = c.shipment_id
                    {$whereClause}
                    GROUP BY DATE_FORMAT(s.import_date, '%Y-%m'), s.customer, s.internal_po_number
                    ORDER BY month DESC, s.customer ASC, s.internal_po_number ASC
                ";
                break;

            case 'yearly':
                $sql = "
                    SELECT
                        YEAR(s.import_date) as year,
                        s.customer,
                        s.internal_po_number as po_number,
                        COUNT(c.id) as cartons_received,
                        COALESCE(SUM(CAST(c.units AS UNSIGNED)), 0) as units_received,
                        COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as cartons_pending,
                        COALESCE(SUM(CASE WHEN c.status = 'pending' THEN CAST(c.units AS UNSIGNED) ELSE 0 END), 0) as units_pending,
                        COUNT(CASE WHEN c.status = 'entered' THEN 1 END) as cartons_entered,
                        COUNT(CASE WHEN c.status = 'exited' THEN 1 END) as cartons_shipped
                    FROM shipments s
                    LEFT JOIN cartons c ON s.id = c.shipment_id
                    {$whereClause}
                    GROUP BY YEAR(s.import_date), s.customer, s.internal_po_number
                    ORDER BY year DESC, s.customer ASC, s.internal_po_number ASC
                ";
                break;

            default:
                return ['success' => false, 'message' => 'Invalid period'];
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $reports = $stmt->fetchAll();

        return [
            'success' => true,
            'period' => $period,
            'date_range' => $startDate && $endDate ? ['start' => $startDate, 'end' => $endDate] : null,
            'reports' => $reports,
            'generated_at' => date('Y-m-d H:i:s')
        ];

    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

/**
 * Generate comprehensive CSV report
 *
 * @param PDO $pdo Database connection
 * @param string $period Time period
 * @param string $startDate Custom start date
 * @param string $endDate Custom end date
 * @return array CSV data or error message
 */
function generateComprehensiveCsvReport($pdo, $period = 'all', $startDate = null, $endDate = null, $customer = null) {
    try {
        // Get comprehensive report data
        $reportData = getComprehensiveReports($pdo, $period, $startDate, $endDate, $customer);

        if (!$reportData['success']) {
            return $reportData;
        }

        $csvData = [];
        $headers = ['Customer', 'FTM PO', 'Total Cartons', 'Total Units', 'Pending Cartons', 'Pending Units', 'Cartons in Warehouse', 'Cartons Shipped'];
        $colCount = count($headers);

        // Header row
        $csvData[] = $headers;

        // Data rows
        foreach ($reportData['top_orders'] as $order) {
            $csvData[] = [
                $order['customer'] ?? 'MRP',
                $order['ftm_po'],
                $order['carton_count'],
                $order['total_units'],
                $order['cartons_pending'],
                $order['units_pending'],
                $order['cartons_in_warehouse'],
                $order['cartons_shipped']
            ];
        }

        // Blank separator row (padded to column count)
        $csvData[] = array_fill(0, $colCount, '');

        // Summary section — label in col 0, value in col 1, rest empty
        $summary = $reportData['summary'];
        $summaryRows = [
            ['SUMMARY STATISTICS', '', '', '', '', '', '', ''],
            ['Total Cartons Expected',       $summary['total_cartons'],       '', '', '', '', '', ''],
            ['Total Units Expected',         $summary['total_units'],         '', '', '', '', '', ''],
            ['Cartons Entered',              $summary['cartons_entered'],     '', '', '', '', '', ''],
            ['Units Entered',                $summary['units_entered'],       '', '', '', '', '', ''],
            ['Orders Entered',               $summary['orders_entered'],      '', '', '', '', '', ''],
            ['Cartons Shipped',              $summary['cartons_shipped'],     '', '', '', '', '', ''],
            ['Units Shipped',                $summary['units_shipped'],       '', '', '', '', '', ''],
            ['Orders Shipped',               $summary['orders_shipped'],      '', '', '', '', '', ''],
            ['Cartons in Warehouse',         $summary['cartons_in_warehouse'], '', '', '', '', '', ''],
            ['Units in Warehouse',           $summary['units_in_warehouse'],  '', '', '', '', '', ''],
            ['Orders in Warehouse',          $summary['orders_in_warehouse'], '', '', '', '', '', ''],
            ['Total Orders',                 $summary['total_orders'],        '', '', '', '', '', ''],
            array_fill(0, $colCount, ''),
            ['Report Period',                ucfirst($reportData['period']),  '', '', '', '', '', ''],
        ];

        if ($reportData['date_range']) {
            $summaryRows[] = ['Date Range', $reportData['date_range']['start'] . ' to ' . $reportData['date_range']['end'], '', '', '', '', '', ''];
        }
        $summaryRows[] = ['Report Generated', $reportData['generated_at'], '', '', '', '', ''];

        foreach ($summaryRows as $row) {
            $csvData[] = $row;
        }

        return [
            'success' => true,
            'filename' => 'comprehensive_report_' . $period . '_' . date('Y-m-d') . '.csv',
            'data' => $csvData
        ];

    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

/**
 * Generate comprehensive PDF report
 *
 * @param PDO $pdo Database connection
 * @param string $period Time period
 * @param string $startDate Custom start date
 * @param string $endDate Custom end date
 * @return array PDF data or error message
 */
function generateComprehensivePdfReport($pdo, $period = 'all', $startDate = null, $endDate = null, $customer = null) {
    try {
        // Get comprehensive report data
        $reportData = getComprehensiveReports($pdo, $period, $startDate, $endDate, $customer);

        if (!$reportData['success']) {
            return $reportData;
        }

        ob_start();

        echo "<html><head>";
        echo "<style>";
        echo "body { font-family: Arial, sans-serif; margin: 0; padding: 0; }";
        echo "h1 { font-size: 20px; color: #333; text-align: center; margin-bottom: 30px; }";
        echo "h2 { font-size: 16px; color: #555; margin: 20px 0 10px 0; }";
        echo "table { width: 100%; border-collapse: collapse; margin: 10px 0; }";
        echo "th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }";
        echo "th { background-color: #f2f2f2; font-weight: bold; }";
        echo ".summary-grid { display: table; width: 100%; margin: 20px 0; }";
        echo ".summary-row { display: table-row; }";
        echo ".summary-cell { display: table-cell; padding: 10px; border: 1px solid #ddd; text-align: center; }";
        echo ".summary-label { font-weight: bold; background-color: #f8f9fa; }";
        echo ".summary-value { font-size: 18px; font-weight: bold; color: #007bff; }";
        echo ".header { text-align: center; margin-bottom: 20px; }";
        echo ".footer { text-align: center; font-size: 12px; margin-top: 30px; color: #666; }";
        echo "</style>";
        echo "</head><body>";

        // Report Header
        echo "<div class='header'>";
        echo "<h1>Warehouse Comprehensive Report</h1>";
        echo "<p><strong>Period:</strong> " . ucfirst($reportData['period']) . "</p>";
        if ($reportData['date_range']) {
            echo "<p><strong>Date Range:</strong> {$reportData['date_range']['start']} to {$reportData['date_range']['end']}</p>";
        }
        echo "<p><strong>Generated:</strong> {$reportData['generated_at']}</p>";
        echo "</div>";

        // Summary Statistics
        echo "<h2>Summary Statistics</h2>";
        echo "<div class='summary-grid'>";
        echo "<div class='summary-row'>";
        echo "<div class='summary-cell summary-label'>Total Cartons Expected</div>";
        echo "<div class='summary-cell summary-value'>{$reportData['summary']['total_cartons']}</div>";
        echo "<div class='summary-cell summary-label'>Total Units Expected</div>";
        echo "<div class='summary-cell summary-value'>{$reportData['summary']['total_units']}</div>";
        echo "</div>";
        echo "<div class='summary-row'>";
        echo "<div class='summary-cell summary-label'>Cartons Entered</div>";
        echo "<div class='summary-cell summary-value'>{$reportData['summary']['cartons_entered']}</div>";
        echo "<div class='summary-cell summary-label'>Cartons Shipped</div>";
        echo "<div class='summary-cell summary-value'>{$reportData['summary']['cartons_shipped']}</div>";
        echo "</div>";
        echo "<div class='summary-row'>";
        echo "<div class='summary-cell summary-label'>Units Entered</div>";
        echo "<div class='summary-cell summary-value'>{$reportData['summary']['units_entered']}</div>";
        echo "<div class='summary-cell summary-label'>Units Shipped</div>";
        echo "<div class='summary-cell summary-value'>{$reportData['summary']['units_shipped']}</div>";
        echo "</div>";
        echo "<div class='summary-row'>";
        echo "<div class='summary-cell summary-label'>Orders Entered</div>";
        echo "<div class='summary-cell summary-value'>{$reportData['summary']['orders_entered']}</div>";
        echo "<div class='summary-cell summary-label'>Orders Shipped</div>";
        echo "<div class='summary-cell summary-value'>{$reportData['summary']['orders_shipped']}</div>";
        echo "</div>";
        echo "<div class='summary-row'>";
        echo "<div class='summary-cell summary-label'>In Warehouse</div>";
        echo "<div class='summary-cell summary-value'>{$reportData['summary']['cartons_in_warehouse']}</div>";
        echo "<div class='summary-cell summary-label'>Total Orders</div>";
        echo "<div class='summary-cell summary-value'>{$reportData['summary']['total_orders']}</div>";
        echo "</div>";
        echo "</div>";

        // Top Orders
        echo "<h2>Top Orders by Carton Count</h2>";
        echo "<table>";
        echo "<tr><th>FTM PO</th><th>Total Cartons</th><th>Total Units</th><th>Pending Cartons</th><th>Pending Units</th><th>In Warehouse</th><th>Shipped</th></tr>";

        foreach ($reportData['top_orders'] as $order) {
            echo "<tr>";
            echo "<td>{$order['ftm_po']}</td>";
            echo "<td>{$order['carton_count']}</td>";
            echo "<td>{$order['total_units']}</td>";
            echo "<td>{$order['cartons_pending']}</td>";
            echo "<td>{$order['units_pending']}</td>";
            echo "<td>{$order['cartons_in_warehouse']}</td>";
            echo "<td>{$order['cartons_shipped']}</td>";
            echo "</tr>";
        }

        echo "</table>";

        // Footer
        echo "<div class='footer'>";
        echo "<p>Warehouse Carton Tracking System &copy; " . date('Y') . "</p>";
        echo "</div>";

        echo "</body></html>";

        $html = ob_get_clean();

        $filename = 'comprehensive_report_' . $period . '_' . date('Y-m-d') . '.pdf';

        return [
            'success' => true,
            'filename' => $filename,
            'html' => $html
        ];

    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

/**
 * Generate time-based CSV report
 *
 * @param PDO $pdo Database connection
 * @param string $period Time period (daily, weekly, monthly, yearly)
 * @return array CSV data or error message
 */
function generateTimeBasedCsvReport($pdo, $period = 'daily', $startDate = null, $endDate = null, $filterPeriod = null) {
    try {
        $reportData = getTimeBasedReports($pdo, $period, $startDate, $endDate, $filterPeriod);

        if (!$reportData['success']) {
            return $reportData;
        }

        $periodLabel = match($period) {
            'weekly'  => 'Week Starting',
            'monthly' => 'Month',
            'yearly'  => 'Year',
            default   => 'Date',
        };

        $headers = [$periodLabel, 'Customer', 'PO Number', 'Total Cartons', 'Total Units', 'Pending Cartons', 'Pending Units', 'Cartons Entered', 'Cartons Shipped'];
        $colCount = count($headers);
        $csvData = [$headers];

        foreach ($reportData['reports'] as $report) {
            $periodValue = match($period) {
                'weekly'  => $report['week_start'],
                'monthly' => $report['month'],
                'yearly'  => $report['year'],
                default   => $report['date'],
            };

            $csvData[] = [
                $periodValue,
                $report['customer'] ?? 'MRP',
                $report['po_number'],
                $report['cartons_received'],
                $report['units_received'],
                $report['cartons_pending'] ?? 0,
                $report['units_pending'] ?? 0,
                $report['cartons_entered'],
                $report['cartons_shipped']
            ];
        }

        // Totals
        $totalCartons  = array_sum(array_column($reportData['reports'], 'cartons_received'));
        $totalUnits    = array_sum(array_column($reportData['reports'], 'units_received'));
        $totalPending  = array_sum(array_map(fn($r) => $r['cartons_pending'] ?? 0, $reportData['reports']));
        $totalUnitsPending = array_sum(array_map(fn($r) => $r['units_pending'] ?? 0, $reportData['reports']));
        $totalEntered  = array_sum(array_column($reportData['reports'], 'cartons_entered'));
        $totalShipped  = array_sum(array_column($reportData['reports'], 'cartons_shipped'));

        $pad = array_fill(0, $colCount - 2, '');

        $csvData[] = array_fill(0, $colCount, '');
        $csvData[] = array_merge(['SUMMARY', ''], $pad);
        $csvData[] = array_merge(['Total Cartons Expected',  $totalCartons],      $pad);
        $csvData[] = array_merge(['Total Units Expected',    $totalUnits],        $pad);
        $csvData[] = array_merge(['Total Pending Cartons',   $totalPending],      $pad);
        $csvData[] = array_merge(['Total Pending Units',     $totalUnitsPending], $pad);
        $csvData[] = array_merge(['Total Cartons Entered',   $totalEntered],      $pad);
        $csvData[] = array_merge(['Total Cartons Shipped',   $totalShipped],      $pad);
        $csvData[] = array_fill(0, $colCount, '');
        $csvData[] = array_merge(['Report Period',    ucfirst($reportData['period'])], $pad);
        if ($reportData['date_range']) {
            $csvData[] = array_merge(['Date Range', $reportData['date_range']['start'] . ' to ' . $reportData['date_range']['end']], $pad);
        }
        $csvData[] = array_merge(['Report Generated', $reportData['generated_at']], $pad);

        return [
            'success'  => true,
            'filename' => 'time_based_report_' . $period . '_' . date('Y-m-d') . '.csv',
            'data'     => $csvData
        ];

    } catch (PDOException $e) {
        return ['success' => false, 'message' => 'Database error: ' . $e->getMessage()];
    }
}

/**
 * Generate time-based PDF report
 *
 * @param PDO $pdo Database connection
 * @param string $period Time period (daily, weekly, monthly, yearly)
 * @return array PDF data or error message
 */
function generateTimeBasedPdfReport($pdo, $period = 'daily', $startDate = null, $endDate = null, $filterPeriod = null) {
    try {
        // Get time-based report data
        $reportData = getTimeBasedReports($pdo, $period, $startDate, $endDate, $filterPeriod);

        if (!$reportData['success']) {
            return $reportData;
        }

        ob_start();

        echo "<html><head>";
        echo "<style>";
        echo "body { font-family: Arial, sans-serif; margin: 20px; }";
        echo "h1 { font-size: 24px; color: #333; text-align: center; margin-bottom: 30px; }";
        echo "h2 { font-size: 18px; color: #555; margin: 20px 0 10px 0; }";
        echo "table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 11px; }";
        echo "th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }";
        echo "th { background-color: #4CAF50; color: white; font-weight: bold; }";
        echo "tr:nth-child(even) { background-color: #f2f2f2; }";
        echo ".summary { background-color: #e8f5e9; padding: 15px; margin: 20px 0; border-radius: 5px; }";
        echo ".summary-item { margin: 5px 0; font-size: 14px; }";
        echo ".header { text-align: center; margin-bottom: 30px; }";
        echo ".footer { text-align: center; font-size: 12px; margin-top: 30px; color: #666; }";
        echo ".text-right { text-align: right; }";
        echo ".po-number { color: #2196F3; font-weight: bold; }";
        echo "</style>";
        echo "</head><body>";

        // Report Header
        echo "<div class='header'>";
        echo "<h1>Time-Based Warehouse Analysis Report</h1>";
        echo "<p><strong>Period:</strong> " . ucfirst($reportData['period']) . "</p>";
        if ($reportData['date_range']) {
            echo "<p><strong>Date Range:</strong> {$reportData['date_range']['start']} to {$reportData['date_range']['end']}</p>";
        }
        echo "<p><strong>Generated:</strong> {$reportData['generated_at']}</p>";
        echo "</div>";

        // Summary Statistics
        $totalReceived = array_sum(array_column($reportData['reports'], 'cartons_received'));
        $totalUnitsReceived = array_sum(array_column($reportData['reports'], 'units_received'));
        $totalPending = array_sum(array_map(function($r) { return $r['cartons_pending'] ?? 0; }, $reportData['reports']));
        $totalUnitsPending = array_sum(array_map(function($r) { return $r['units_pending'] ?? 0; }, $reportData['reports']));
        $totalEntered = array_sum(array_column($reportData['reports'], 'cartons_entered'));
        $totalShipped = array_sum(array_column($reportData['reports'], 'cartons_shipped'));

        echo "<div class='summary'>";
        echo "<h2>Summary Statistics</h2>";
        echo "<div class='summary-item'><strong>Total Cartons Expected:</strong> " . number_format($totalReceived) . "</div>";
        echo "<div class='summary-item'><strong>Total Units Expected:</strong> " . number_format($totalUnitsReceived) . "</div>";
        echo "<div class='summary-item'><strong>Total Pending Cartons:</strong> " . number_format($totalPending) . "</div>";
        echo "<div class='summary-item'><strong>Total Pending Units:</strong> " . number_format($totalUnitsPending) . "</div>";
        echo "<div class='summary-item'><strong>Total Cartons Entered:</strong> " . number_format($totalEntered) . "</div>";
        echo "<div class='summary-item'><strong>Total Cartons Shipped:</strong> " . number_format($totalShipped) . "</div>";
        echo "</div>";

        // Detailed Report Table
        echo "<h2>Detailed Breakdown by PO</h2>";
        echo "<table>";
        echo "<thead><tr>";

        // Period column header
        switch ($period) {
            case 'daily':
                echo "<th>Date</th>";
                break;
            case 'weekly':
                echo "<th>Week Starting</th>";
                break;
            case 'monthly':
                echo "<th>Month</th>";
                break;
            case 'yearly':
                echo "<th>Year</th>";
                break;
        }

        echo "<th>PO Number</th>";
        echo "<th class='text-right'>Total Cartons</th>";
        echo "<th class='text-right'>Total Units</th>";
        echo "<th class='text-right'>Pending Cartons</th>";
        echo "<th class='text-right'>Pending Units</th>";
        echo "<th class='text-right'>Cartons Entered</th>";
        echo "<th class='text-right'>Cartons Shipped</th>";
        echo "</tr></thead>";
        echo "<tbody>";

        foreach ($reportData['reports'] as $report) {
            echo "<tr>";

            // Period value
            if ($period === 'daily') {
                echo "<td>{$report['date']}</td>";
            } elseif ($period === 'weekly') {
                echo "<td>{$report['week_start']}</td>";
            } elseif ($period === 'monthly') {
                echo "<td>{$report['month']}</td>";
            } elseif ($period === 'yearly') {
                echo "<td>{$report['year']}</td>";
            }

            echo "<td class='po-number'>{$report['po_number']}</td>";
            echo "<td class='text-right'>" . number_format($report['cartons_received']) . "</td>";
            echo "<td class='text-right'>" . number_format($report['units_received']) . "</td>";
            echo "<td class='text-right'>" . number_format($report['cartons_pending'] ?? 0) . "</td>";
            echo "<td class='text-right'>" . number_format($report['units_pending'] ?? 0) . "</td>";
            echo "<td class='text-right'>" . number_format($report['cartons_entered']) . "</td>";
            echo "<td class='text-right'>" . number_format($report['cartons_shipped']) . "</td>";
            echo "</tr>";
        }

        echo "</tbody></table>";

        // Footer
        echo "<div class='footer'>";
        echo "<p>FTM Garments Warehouse Tracking System &copy; " . date('Y') . "</p>";
        echo "<p>This report was automatically generated on " . date('F j, Y \a\t g:i A') . "</p>";
        echo "</div>";

        echo "</body></html>";

        $html = ob_get_clean();

        return [
            'success' => true,
            'filename' => 'time_based_report_' . $period . '_' . date('Y-m-d') . '.pdf',
            'html' => $html
        ];

    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

/**
 * Generate warehouse inventory CSV report
 *
 * @param PDO $pdo Database connection
 * @return array CSV data or error message
 */
function generateInventoryCsvReport($pdo) {
    try {
        $inventoryData = getWarehouseInventory($pdo);

        if (!$inventoryData['success']) {
            return $inventoryData;
        }

        $headers = ['Customer', 'FTM PO', 'File Name', 'Import Date', 'Total Cartons', 'Total Units', 'Pending Cartons', 'Pending Units', 'Days in Warehouse (Oldest)', 'Days in Warehouse (Newest)', 'Avg Days in Warehouse'];
        $colCount = count($headers);
        $pad = array_fill(0, $colCount - 2, '');
        $csvData = [$headers];

        foreach ($inventoryData['inventory'] as $item) {
            $csvData[] = [
                $item['customer'] ?? 'MRP',
                $item['ftm_po'],
                $item['file_name'],
                date('Y-m-d', strtotime($item['import_date'])),
                $item['total_cartons'],
                $item['total_units'],
                $item['cartons_pending'] ?? 0,
                $item['units_pending'] ?? 0,
                $item['oldest_carton_days'],
                $item['newest_carton_days'],
                round($item['avg_carton_days'], 1)
            ];
        }

        $csvData[] = array_fill(0, $colCount, '');
        $csvData[] = array_merge(['SUMMARY', ''], $pad);
        $csvData[] = array_merge(['Total Cartons in Warehouse', $inventoryData['total_cartons']], $pad);
        $csvData[] = array_merge(['Total Active Orders',        $inventoryData['total_orders']], $pad);
        $csvData[] = array_merge(['Maximum Days in Warehouse',  $inventoryData['max_days_in_warehouse']], $pad);
        $csvData[] = array_merge(['Average Days in Warehouse',  $inventoryData['avg_days_in_warehouse']], $pad);
        $csvData[] = array_merge(['Report Generated',           $inventoryData['generated_at']], $pad);

        return [
            'success'  => true,
            'filename' => 'warehouse_inventory_' . date('Y-m-d') . '.csv',
            'data'     => $csvData
        ];

    } catch (PDOException $e) {
        return ['success' => false, 'message' => 'Database error: ' . $e->getMessage()];
    }
}

/**
 * Generate warehouse inventory PDF report
 *
 * @param PDO $pdo Database connection
 * @return array PDF data or error message
 */
function generateInventoryPdfReport($pdo) {
    try {
        $inventoryData = getWarehouseInventory($pdo);

        if (!$inventoryData['success']) {
            return $inventoryData;
        }

        ob_start();

        echo "<html><head>";
        echo "<style>";
        echo "body { font-family: Arial, sans-serif; margin: 20px; }";
        echo "h1 { font-size: 24px; color: #333; text-align: center; margin-bottom: 30px; }";
        echo "h2 { font-size: 18px; color: #555; margin: 20px 0 10px 0; }";
        echo "table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }";
        echo "th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }";
        echo "th { background-color: #2196F3; color: white; font-weight: bold; }";
        echo "tr:nth-child(even) { background-color: #f2f2f2; }";
        echo ".summary { background-color: #e3f2fd; padding: 15px; margin: 20px 0; border-radius: 5px; }";
        echo ".summary-item { margin: 5px 0; font-size: 14px; }";
        echo ".header { text-align: center; margin-bottom: 30px; }";
        echo ".footer { text-align: center; font-size: 12px; margin-top: 30px; color: #666; }";
        echo ".text-right { text-align: right; }";
        echo ".badge-warning { background-color: #ff9800; color: white; padding: 3px 8px; border-radius: 3px; }";
        echo ".badge-danger { background-color: #f44336; color: white; padding: 3px 8px; border-radius: 3px; }";
        echo ".badge-success { background-color: #4caf50; color: white; padding: 3px 8px; border-radius: 3px; }";
        echo "</style>";
        echo "</head><body>";

        // Header
        echo "<div class='header'>";
        echo "<h1>Warehouse Inventory Report</h1>";
        echo "<p><strong>Generated:</strong> {$inventoryData['generated_at']}</p>";
        echo "</div>";

        // Summary
        echo "<div class='summary'>";
        echo "<h2>Summary Statistics</h2>";
        echo "<div class='summary-item'><strong>Total Cartons in Warehouse:</strong> " . number_format($inventoryData['total_cartons']) . "</div>";
        echo "<div class='summary-item'><strong>Total Active Orders:</strong> " . number_format($inventoryData['total_orders']) . "</div>";
        echo "<div class='summary-item'><strong>Maximum Days in Warehouse:</strong> " . $inventoryData['max_days_in_warehouse'] . " days</div>";
        echo "<div class='summary-item'><strong>Average Days in Warehouse:</strong> " . $inventoryData['avg_days_in_warehouse'] . " days</div>";
        echo "</div>";

        // Detailed inventory
        echo "<h2>Detailed Inventory by Order</h2>";
        echo "<table>";
        echo "<thead><tr>";
        echo "<th>FTM PO</th>";
        echo "<th>File Name</th>";
        echo "<th>Import Date</th>";
        echo "<th class='text-right'>Total Cartons</th>";
        echo "<th class='text-right'>Total Units</th>";
        echo "<th class='text-right'>Pending Cartons</th>";
        echo "<th class='text-right'>Pending Units</th>";
        echo "<th class='text-right'>Days in Warehouse</th>";
        echo "</tr></thead>";
        echo "<tbody>";

        foreach ($inventoryData['inventory'] as $item) {
            echo "<tr>";
            echo "<td><strong>{$item['ftm_po']}</strong></td>";
            echo "<td>{$item['file_name']}</td>";
            echo "<td>" . date('M d, Y', strtotime($item['import_date'])) . "</td>";
            echo "<td class='text-right'>" . number_format($item['total_cartons']) . "</td>";
            echo "<td class='text-right'>" . number_format($item['total_units']) . "</td>";
            echo "<td class='text-right'>" . number_format($item['cartons_pending'] ?? 0) . "</td>";
            echo "<td class='text-right'>" . number_format($item['units_pending'] ?? 0) . "</td>";

            // Color code based on days
            $days = $item['oldest_carton_days'];
            $badgeClass = 'badge-success';
            if ($days > 30) $badgeClass = 'badge-warning';
            if ($days > 60) $badgeClass = 'badge-danger';

            echo "<td class='text-right'><span class='{$badgeClass}'>{$days} days</span></td>";
            echo "</tr>";
        }

        echo "</tbody></table>";

        // Footer
        echo "<div class='footer'>";
        echo "<p>FTM Garments Warehouse Tracking System &copy; " . date('Y') . "</p>";
        echo "<p>This report shows all cartons currently in the warehouse (status: entered)</p>";
        echo "</div>";

        echo "</body></html>";

        $html = ob_get_clean();

        return [
            'success' => true,
            'filename' => 'warehouse_inventory_' . date('Y-m-d') . '.pdf',
            'html' => $html
        ];

    } catch (PDOException $e) {
        return [
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ];
    }
}

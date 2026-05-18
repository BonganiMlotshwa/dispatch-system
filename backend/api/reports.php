<?php
/**
 * Reports API Endpoint
 * 
 * This file serves as the API endpoint for report-related operations.
 */

// Include necessary files
require_once '../includes/reports.php';
require_once '../config/database.php';

// Set CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Set headers for JSON response
header('Content-Type: application/json');

// Handle different actions
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'getDashboardSummary':
        $pdo = getDbConnection();
        $result = getDashboardSummary($pdo);
        echo json_encode($result);
        break;

    case 'getComprehensiveReports':
        $pdo = getDbConnection();
        $period = isset($_GET['period']) ? $_GET['period'] : 'all';
        $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
        $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;
        $customer = isset($_GET['customer']) ? $_GET['customer'] : null;
        $result = getComprehensiveReports($pdo, $period, $startDate, $endDate, $customer);
        echo json_encode($result);
        break;

    case 'getWarehouseInventory':
        $pdo = getDbConnection();
        $result = getWarehouseInventory($pdo);
        echo json_encode($result);
        break;

    case 'getTimeBasedReports':
        $pdo = getDbConnection();
        $period = isset($_GET['period']) ? $_GET['period'] : 'daily';
        $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
        $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;
        $filterPeriod = isset($_GET['filter_period']) ? $_GET['filter_period'] : null;
        $result = getTimeBasedReports($pdo, $period, $startDate, $endDate, $filterPeriod);
        echo json_encode($result);
        break;

    case 'getShipmentDetails':
        $shipmentId = isset($_GET['shipmentId']) ? intval($_GET['shipmentId']) : 0;
        if ($shipmentId > 0) {
            $pdo = getDbConnection();
            $result = getShipmentDetails($pdo, $shipmentId);
            echo json_encode($result);
        } else {
            echo json_encode(['error' => 'Invalid shipment ID']);
        }
        break;

    case 'getShipmentCartons':
        $shipmentId = isset($_GET['shipmentId']) ? intval($_GET['shipmentId']) : 0;
        $filters = isset($_GET['filters']) ? $_GET['filters'] : [];
        if ($shipmentId > 0) {
            $pdo = getDbConnection();
            $result = getShipmentCartons($pdo, $shipmentId, $filters);
            echo json_encode($result);
        } else {
            echo json_encode(['error' => 'Invalid shipment ID']);
        }
        break;

    case 'generateShipmentCsvReport':
        $shipmentId = isset($_GET['shipmentId']) ? intval($_GET['shipmentId']) : 0;
        if ($shipmentId > 0) {
            $pdo = getDbConnection();
            generateShipmentCsvReport($pdo, $shipmentId);
        } else {
            echo json_encode(['error' => 'Invalid shipment ID']);
        }
        break;

    case 'generateShipmentPdfReport':
        $shipmentId = isset($_GET['shipmentId']) ? intval($_GET['shipmentId']) : 0;
        if ($shipmentId > 0) {
            $pdo = getDbConnection();
            generateShipmentPdfReport($pdo, $shipmentId);
        } else {
            echo json_encode(['error' => 'Invalid shipment ID']);
        }
        break;

    case 'generateComprehensiveCsvReport':
        $pdo = getDbConnection();
        $period = isset($_GET['period']) ? $_GET['period'] : 'all';
        $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
        $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;
        $customer = isset($_GET['customer']) ? $_GET['customer'] : null;
        $result = generateComprehensiveCsvReport($pdo, $period, $startDate, $endDate, $customer);
        
        if ($result['success']) {
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="' . $result['filename'] . '"');
            header('Pragma: no-cache');
            header('Expires: 0');
            
            $output = fopen('php://output', 'w');
            
            // Add BOM for Excel UTF-8 compatibility
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
            
            foreach ($result['data'] as $row) {
                fputcsv($output, $row);
            }
            fclose($output);
            exit;
        } else {
            echo json_encode($result);
        }
        break;

    case 'generateComprehensivePdfReport':
        $pdo = getDbConnection();
        $period = isset($_GET['period']) ? $_GET['period'] : 'all';
        $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
        $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;
        $customer = isset($_GET['customer']) ? $_GET['customer'] : null;
        $result = generateComprehensivePdfReport($pdo, $period, $startDate, $endDate, $customer);
        echo json_encode($result);
        break;

    case 'generateTimeBasedCsvReport':
        $pdo = getDbConnection();
        $period = isset($_GET['period']) ? $_GET['period'] : 'daily';
        $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
        $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;
        $filterPeriod = isset($_GET['filter_period']) ? $_GET['filter_period'] : null;
        $result = generateTimeBasedCsvReport($pdo, $period, $startDate, $endDate, $filterPeriod);
        
        if ($result['success']) {
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="' . $result['filename'] . '"');
            header('Pragma: no-cache');
            header('Expires: 0');
            
            $output = fopen('php://output', 'w');
            
            // Add BOM for Excel UTF-8 compatibility
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
            
            foreach ($result['data'] as $row) {
                fputcsv($output, $row);
            }
            fclose($output);
            exit;
        } else {
            echo json_encode($result);
        }
        break;

    case 'generateTimeBasedPdfReport':
        $pdo = getDbConnection();
        $period = isset($_GET['period']) ? $_GET['period'] : 'daily';
        $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
        $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;
        $filterPeriod = isset($_GET['filter_period']) ? $_GET['filter_period'] : null;
        $result = generateTimeBasedPdfReport($pdo, $period, $startDate, $endDate, $filterPeriod);
        echo json_encode($result);
        break;

    case 'generateInventoryCsvReport':
        $pdo = getDbConnection();
        $result = generateInventoryCsvReport($pdo);
        
        if ($result['success']) {
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="' . $result['filename'] . '"');
            header('Pragma: no-cache');
            header('Expires: 0');
            
            $output = fopen('php://output', 'w');
            
            // Add BOM for Excel UTF-8 compatibility
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
            
            foreach ($result['data'] as $row) {
                fputcsv($output, $row);
            }
            fclose($output);
            exit;
        } else {
            echo json_encode($result);
        }
        break;

    case 'generateInventoryPdfReport':
        $pdo = getDbConnection();
        $result = generateInventoryPdfReport($pdo);
        echo json_encode($result);
        break;

    default:
        echo json_encode(['error' => 'Invalid action']);
        break;
}
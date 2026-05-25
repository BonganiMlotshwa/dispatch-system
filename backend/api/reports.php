<?php
/**
 * Reports API Endpoint
 */

require_once '../includes/reports.php';
require_once '../includes/csv_export.php';
require_once '../config/database.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

header('Content-Type: application/json');

$action = isset($_GET['action']) ? $_GET['action'] : '';

function outputCsv($filename, $data) {
    csvOutputRows($filename, $data);
}

switch ($action) {

    case 'getDashboardSummary':
        echo json_encode(getDashboardSummary(getDbConnection()));
        break;

    case 'getComprehensiveReports':
        $pdo       = getDbConnection();
        $period    = $_GET['period']     ?? 'all';
        $startDate = $_GET['start_date'] ?? null;
        $endDate   = $_GET['end_date']   ?? null;
        $customer  = $_GET['customer']   ?? null;
        echo json_encode(getComprehensiveReports($pdo, $period, $startDate, $endDate, $customer));
        break;

    case 'getWarehouseInventory':
        echo json_encode(getWarehouseInventory(getDbConnection()));
        break;

    case 'getTimeBasedReports':
        $pdo          = getDbConnection();
        $period       = $_GET['period']        ?? 'daily';
        $startDate    = $_GET['start_date']    ?? null;
        $endDate      = $_GET['end_date']      ?? null;
        $filterPeriod = $_GET['filter_period'] ?? null;
        echo json_encode(getTimeBasedReports($pdo, $period, $startDate, $endDate, $filterPeriod));
        break;

    case 'getDailyEnteredByCustomer':
        $pdo          = getDbConnection();
        $startDate    = $_GET['start_date']    ?? null;
        $endDate      = $_GET['end_date']      ?? null;
        $filterPeriod = $_GET['filter_period'] ?? $_GET['period'] ?? 'all';
        echo json_encode(getDailyEnteredByCustomer($pdo, $startDate, $endDate, $filterPeriod));
        break;

    case 'getShipmentDetails':
        $shipmentId = intval($_GET['shipmentId'] ?? 0);
        if ($shipmentId > 0) {
            echo json_encode(getShipmentDetails($shipmentId, getDbConnection()));
        } else {
            echo json_encode(['error' => 'Invalid shipment ID']);
        }
        break;

    case 'getShipmentCartons':
        $shipmentId = intval($_GET['shipmentId'] ?? 0);
        $filters    = $_GET['filters'] ?? [];
        if ($shipmentId > 0) {
            echo json_encode(getShipmentCartons($shipmentId, $filters, getDbConnection()));
        } else {
            echo json_encode(['error' => 'Invalid shipment ID']);
        }
        break;

    case 'generateComprehensiveCsvReport':
        $pdo       = getDbConnection();
        $period    = $_GET['period']     ?? 'all';
        $startDate = $_GET['start_date'] ?? null;
        $endDate   = $_GET['end_date']   ?? null;
        $customer  = $_GET['customer']   ?? null;
        $result    = generateComprehensiveCsvReport($pdo, $period, $startDate, $endDate, $customer);
        if ($result['success']) {
            outputCsv($result['filename'], $result['data']);
        } else {
            echo json_encode($result);
        }
        break;

    case 'generateComprehensivePdfReport':
        $pdo       = getDbConnection();
        $period    = $_GET['period']     ?? 'all';
        $startDate = $_GET['start_date'] ?? null;
        $endDate   = $_GET['end_date']   ?? null;
        $customer  = $_GET['customer']   ?? null;
        echo json_encode(generateComprehensivePdfReport($pdo, $period, $startDate, $endDate, $customer));
        break;

    case 'generateTimeBasedCsvReport':
        $pdo          = getDbConnection();
        $period       = $_GET['period']        ?? 'daily';
        $startDate    = $_GET['start_date']    ?? null;
        $endDate      = $_GET['end_date']      ?? null;
        $filterPeriod = $_GET['filter_period'] ?? null;
        $result       = generateTimeBasedCsvReport($pdo, $period, $startDate, $endDate, $filterPeriod);
        if ($result['success']) {
            outputCsv($result['filename'], $result['data']);
        } else {
            echo json_encode($result);
        }
        break;

    case 'generateTimeBasedPdfReport':
        $pdo          = getDbConnection();
        $period       = $_GET['period']        ?? 'daily';
        $startDate    = $_GET['start_date']    ?? null;
        $endDate      = $_GET['end_date']      ?? null;
        $filterPeriod = $_GET['filter_period'] ?? null;
        echo json_encode(generateTimeBasedPdfReport($pdo, $period, $startDate, $endDate, $filterPeriod));
        break;

    case 'generateInventoryCsvReport':
        $result = generateInventoryCsvReport(getDbConnection());
        if ($result['success']) {
            outputCsv($result['filename'], $result['data']);
        } else {
            echo json_encode($result);
        }
        break;

    case 'generateInventoryPdfReport':
        echo json_encode(generateInventoryPdfReport(getDbConnection()));
        break;

    default:
        echo json_encode(['error' => 'Invalid action']);
        break;
}

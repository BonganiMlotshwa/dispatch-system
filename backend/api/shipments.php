<?php
/**
 * Shipments API Endpoint
 * 
 * This endpoint provides shipment details and carton data.
 */

// Set headers for API response
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Cache-Control, X-Requested-With');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Only GET method is allowed']);
    exit;
}

// Include required files
require_once '../config/database.php';
require_once '../includes/reports.php';

// Generate cache key based on request parameters
$cacheKey = md5($_SERVER['REQUEST_URI'] . serialize($_GET));
$cacheFile = "../cache/shipments_{$cacheKey}.json";
$cacheTime = 15; // Reduced cache time to 15 seconds for faster updates
$cachingEnabled = false; // Disabled to ensure immediate updates for new POs

// Check if cache directory exists, create if not
if (!is_dir('../cache')) {
    mkdir('../cache', 0755, true);
}

// Allow cache bypass with refresh parameter
$forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === 'true';

// Check if cached data exists and is still valid (unless force refresh or caching disabled)
if ($cachingEnabled && !$forceRefresh && file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTime) {
    $cachedData = file_get_contents($cacheFile);
    if ($cachedData) {
        header('X-Cache: HIT');
        echo $cachedData;
        exit;
    }
}

try {
    // Get database connection
    $pdo = getDbConnection();
    
    // Check if export is requested (must check BEFORE regular id check)
    if (isset($_GET['export']) && isset($_GET['id'])) {
        $shipmentId = (int)$_GET['id'];
        $exportType = $_GET['export'];
        
        // Handle CSV export
        if ($exportType === 'csv') {
            // Generate CSV report
            $csvReport = generateShipmentCsvReport($shipmentId, $pdo);
            
            if (!$csvReport['success']) {
                throw new Exception($csvReport['message']);
            }
            
            // Set headers for CSV download
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="' . $csvReport['filename'] . '"');
            header('Pragma: no-cache');
            header('Expires: 0');
            
            // Output CSV data with UTF-8 BOM so Excel splits columns correctly
            $output = fopen('php://output', 'w');
            fputs($output, "\xEF\xBB\xBF");
            // sep= hint forces Excel to use comma as delimiter regardless of regional settings
            fputs($output, "sep=,\n");
            foreach ($csvReport['data'] as $row) {
                fputcsv($output, $row, ',', '"');
            }
            fclose($output);
            exit;
        }
        // Handle PDF export
        else if ($exportType === 'pdf') {
            // Generate PDF report
            $pdfReport = generateShipmentPdfReport($shipmentId, $pdo);
            
            if (!$pdfReport['success']) {
                throw new Exception($pdfReport['message']);
            }
            
            // Set headers for HTML display (for browser print)
            header('Content-Type: text/html; charset=utf-8');
            
            // Output PDF HTML content for browser printing
            echo $pdfReport['html'];
            exit;
        }
    }
    // Check if a specific shipment ID is requested
    else if (isset($_GET['id'])) {
        $shipmentId = (int)$_GET['id'];
        
        // Get shipment details
        $shipmentDetails = getShipmentDetails($shipmentId, $pdo);
        
        if (!$shipmentDetails['success']) {
            throw new Exception($shipmentDetails['message']);
        }
        
        // Check if cartons are also requested
        if (isset($_GET['cartons']) && $_GET['cartons'] === 'true') {
            // Prepare filters
            $filters = [];
            
            // Apply status filter if provided
            if (isset($_GET['status']) && in_array($_GET['status'], ['pending', 'entered', 'exited'])) {
                $filters['status'] = $_GET['status'];
            }
            
            // Apply size filter if provided
            if (isset($_GET['size'])) {
                $filters['size'] = $_GET['size'];
            }
            
            // Get cartons with filters
            $cartons = getShipmentCartons($shipmentId, $filters, $pdo);
            
            if (!$cartons['success']) {
                throw new Exception($cartons['message']);
            }
            
            // Add cartons to the response
            $shipmentDetails['cartons'] = $cartons['cartons'];
        }
        
        // Cache and return shipment details
        $response = json_encode($shipmentDetails);
        if ($cachingEnabled) {
            file_put_contents($cacheFile, $response);
            header('X-Cache: MISS');
        } else {
            header('X-Cache: DISABLED');
        }
        echo $response;
    }
    // List all shipments
    else {
        // Get all shipments with customer PO number from first carton
        $stmt = $pdo->query("SELECT s.*, 
                            (SELECT COUNT(*) FROM cartons WHERE shipment_id = s.id) as carton_count,
                            (SELECT COUNT(*) FROM cartons WHERE shipment_id = s.id AND status = 'exited') as shipped_count,
                            (SELECT COUNT(*) FROM cartons WHERE shipment_id = s.id AND status = 'entered') as in_warehouse_count,
                            (SELECT po_number FROM cartons WHERE shipment_id = s.id LIMIT 1) as customer_po_number
                            FROM shipments s 
                            ORDER BY import_date DESC");
        $shipments = $stmt->fetchAll();
        
        $response = json_encode([
            'success' => true,
            'shipments' => $shipments
        ]);
        if ($cachingEnabled) {
            file_put_contents($cacheFile, $response);
            header('X-Cache: MISS');
        } else {
            header('X-Cache: DISABLED');
        }
        echo $response;
    }
    
} catch (Exception $e) {
    http_response_code(400); // Bad Request
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
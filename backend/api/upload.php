<?php
/**
 * File Upload API Endpoint
 * 
 * This endpoint handles XML file uploads and processing.
 */

// Set headers for API response
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); // Method Not Allowed
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed']);
    exit;
}

// Include required files
require_once '../config/database.php';
require_once '../includes/xml_parser.php';
require_once '../includes/schedule_lookup.php';

// Debug logging
file_put_contents(__DIR__ . '/../../debug_log.txt', date('Y-m-d H:i:s') . ' - Request: ' . print_r($_REQUEST, true) . "\n", FILE_APPEND);
file_put_contents(__DIR__ . '/../../debug_log.txt', date('Y-m-d H:i:s') . ' - Files: ' . print_r($_FILES, true) . "\n", FILE_APPEND);

try {
    // Get database connection
    $pdo = getDbConnection();
    
    // Check if file was uploaded
if (!isset($_FILES['xmlFile'])) {
    throw new Exception('No file uploaded: xmlFile field not found in request');
}

if ($_FILES['xmlFile']['error'] !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE => 'The uploaded file exceeds the upload_max_filesize directive in php.ini',
        UPLOAD_ERR_FORM_SIZE => 'The uploaded file exceeds the MAX_FILE_SIZE directive in the HTML form',
        UPLOAD_ERR_PARTIAL => 'The uploaded file was only partially uploaded',
        UPLOAD_ERR_NO_FILE => 'No file was uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing a temporary folder',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
        UPLOAD_ERR_EXTENSION => 'A PHP extension stopped the file upload'
    ];
    
    $errorMessage = isset($errorMessages[$_FILES['xmlFile']['error']]) 
        ? $errorMessages[$_FILES['xmlFile']['error']] 
        : 'Unknown upload error';
    
    throw new Exception('Upload error: ' . $errorMessage);
}
    
    $importMode = strtolower(trim($_POST['importMode'] ?? 'linked'));
    $internalPoNumber = !empty($_POST['internalPoNumber']) ? trim($_POST['internalPoNumber']) : '';
    $style = !empty($_POST['style']) ? trim($_POST['style']) : '';
    $color = !empty($_POST['color']) ? trim($_POST['color']) : '';
    $quantity = !empty($_POST['quantity']) ? trim($_POST['quantity']) : '';
    $scheduleId = !empty($_POST['scheduleId']) ? (int) $_POST['scheduleId'] : null;
    $customerOrderNo = trim($_POST['customerOrderNo'] ?? '');
    $uploadedFile = $_FILES['xmlFile'];
    
    // Validate file type (should be .mrpg)
    $fileExtension = strtolower(pathinfo($uploadedFile['name'], PATHINFO_EXTENSION));
    if ($fileExtension !== 'mrpg') {
        throw new Exception('Invalid file type. Only .mrpg files are allowed');
    }
    
    // Create uploads directory if it doesn't exist
    $uploadDir = '../uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    // Generate unique filename to prevent overwriting
    $targetFilePath = $uploadDir . time() . '_' . basename($uploadedFile['name']);
    
    // Move uploaded file to target directory
    if (!move_uploaded_file($uploadedFile['tmp_name'], $targetFilePath)) {
        throw new Exception('Failed to move uploaded file');
    }

    $metadata = extractMrpgMetadata($targetFilePath);
    if (!$metadata['success']) {
        unlink($targetFilePath);
        throw new Exception($metadata['message']);
    }

    if ($customerOrderNo === '') {
        $customerOrderNo = (string) $metadata['customer_order_no'];
    }

    $scheduleStatus = 'manual';
    $scheduleWeekLabel = null;
    $lookup = null;

    if ($importMode === 'unlinked') {
        if ($customerOrderNo === '') {
            unlink($targetFilePath);
            throw new Exception('Could not determine customer order number from file.');
        }
        $internalPoNumber = 'PENDING-' . $customerOrderNo;
        $style = $style !== '' ? $style : 'Pending schedule';
        $color = $color !== '' ? $color : 'Pending schedule';
        $quantity = $quantity !== '' ? $quantity : '';
        $scheduleStatus = 'unlinked';
    } else {
        if ($internalPoNumber === '') {
            unlink($targetFilePath);
            throw new Exception('FTM PO number is required for linked import.');
        }
        if ($style === '' || $color === '' || $quantity === '') {
            unlink($targetFilePath);
            throw new Exception('Style, color, and quantity are required for linked import.');
        }

        $lookup = scheduleLookupOrderInLibrary($pdo, $customerOrderNo, $scheduleId);
        if (!empty($lookup['match'])) {
            $scheduleStatus = 'linked';
            $scheduleId = $lookup['match']['schedule_id'];
            $scheduleWeekLabel = $lookup['match']['week_label'];
        } else {
            $scheduleStatus = 'manual';
        }
    }

    file_put_contents(__DIR__ . '/../../debug_log.txt', date('Y-m-d H:i:s') . ' - Import mode: ' . $importMode . ', PO: ' . $internalPoNumber . "\n", FILE_APPEND);
    
    // Parse the XML file
    $parseResult = parseXmlFile($targetFilePath, $internalPoNumber);
    
    if (!$parseResult['success']) {
        // Delete the file if parsing failed
        unlink($targetFilePath);
        throw new Exception($parseResult['message']);
    }
    
    // Add additional fields to parse result
    $parseResult['style'] = $style;
    $parseResult['color'] = $color;
    $parseResult['quantity'] = $quantity;
    $parseResult['import_mode'] = $importMode;
    $parseResult['schedule_status'] = $scheduleStatus;
    $parseResult['customer_order_no'] = $customerOrderNo;
    $parseResult['schedule_id'] = $scheduleId;
    $parseResult['schedule_week_label'] = $scheduleWeekLabel;
    
    // Save the imported data to database
    $saveResult = saveImportedData($parseResult, $pdo);
    
    if (!$saveResult['success']) {
        // Delete the file if saving failed
        unlink($targetFilePath);
        throw new Exception($saveResult['message']);
    }
    
    // Return success response
    $response = [
        'success' => true,
        'message' => $importMode === 'unlinked'
            ? 'File imported without schedule. Link when schedule is available.'
            : 'File uploaded and processed successfully',
        'shipment_id' => $saveResult['shipment_id'],
        'cartons_imported' => $saveResult['cartons_imported'],
        'po_number' => $internalPoNumber,
        'schedule_status' => $saveResult['schedule_status'] ?? $scheduleStatus,
        'customer_order_no' => $customerOrderNo,
    ];
    
    // Log success response
    file_put_contents(__DIR__ . '/../../debug_log.txt', date('Y-m-d H:i:s') . ' - Success Response: ' . json_encode($response) . "\n", FILE_APPEND);
    
    echo json_encode($response);
    
} catch (Exception $e) {
    http_response_code(400); // Bad Request
    
    // Log the error for debugging
    file_put_contents(__DIR__ . '/../../debug_log.txt', date('Y-m-d H:i:s') . ' - Upload Error: ' . $e->getMessage() . "\n", FILE_APPEND);
    
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'error' => $e->getMessage() // For backward compatibility
    ]);
}
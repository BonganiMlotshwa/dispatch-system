<?php
/**
 * Sticker Generation API Endpoint
 *
 * This endpoint provides data for sticker generation with filtering by FTM PO and PO number.
 */

// Set headers for API response
header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['GET', 'POST']);
require_once '../includes/auth.php';
auth_require_user();

// Only allow GET and POST requests
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'])) {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only GET and POST methods are allowed']);
    exit;
}

// Include required files
require_once '../config/database.php';

try {
    // Get database connection
    $pdo = getDbConnection();

    // Get filter parameters
    $ftm_po = isset($_GET['ftm_po']) ? trim($_GET['ftm_po']) : null;
    $po_number = isset($_GET['po_number']) ? trim($_GET['po_number']) : null;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
    $limit = min($limit, 500);
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

    // Build query with filters
    $whereConditions = [];
    $params = [];

    if ($ftm_po) {
        $whereConditions[] = "s.internal_po_number LIKE ?";
        $params[] = "%$ftm_po%";
    }

    if ($po_number) {
        $whereConditions[] = "c.po_number LIKE ?";
        $params[] = "%$po_number%";
    }

    $whereClause = !empty($whereConditions) ? "WHERE " . implode(" AND ", $whereConditions) : "";

    // Get total count
    $countQuery = "
        SELECT COUNT(*) as total
        FROM cartons c
        JOIN shipments s ON c.shipment_id = s.id
        $whereClause
    ";

    $countStmt = $pdo->prepare($countQuery);
    $countStmt->execute($params);
    $totalCount = $countStmt->fetch()['total'];

    // Get individual carton data for stickers (each carton gets its own sticker)
    $query = "
        SELECT
            c.id as carton_id,
            s.internal_po_number as ftm_po,
            c.po_number,
            c.size,
            c.units,
            c.item,
            c.barcode_2d,
            c.status,
            1 as carton_count,
            c.barcode_2d as barcodes
        FROM cartons c
        JOIN shipments s ON c.shipment_id = s.id
        $whereClause
        ORDER BY s.internal_po_number, c.po_number, c.id
        LIMIT ? OFFSET ?
    ";

    $params[] = $limit;
    $params[] = $offset;

    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $stickers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get summary statistics
    $summaryQuery = "
        SELECT
            COUNT(DISTINCT CONCAT(s.internal_po_number, '-', c.po_number)) as total_po_combinations,
            COUNT(DISTINCT s.internal_po_number) as total_ftm_pos,
            COUNT(DISTINCT c.po_number) as total_po_numbers,
            SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
            SUM(CASE WHEN c.status = 'entered' THEN 1 ELSE 0 END) as entered_count,
            SUM(CASE WHEN c.status = 'exited' THEN 1 ELSE 0 END) as exited_count
        FROM cartons c
        JOIN shipments s ON c.shipment_id = s.id
        $whereClause
    ";

    $summaryStmt = $pdo->prepare($summaryQuery);
    $summaryStmt->execute(array_slice($params, 0, -2)); // Remove limit and offset
    $summary = $summaryStmt->fetch(PDO::FETCH_ASSOC);

    // Return success response
    echo json_encode([
        'success' => true,
        'data' => [
            'stickers' => $stickers,
            'summary' => $summary,
            'pagination' => [
                'total' => $totalCount,
                'limit' => $limit,
                'offset' => $offset,
                'has_more' => ($offset + $limit) < $totalCount
            ]
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
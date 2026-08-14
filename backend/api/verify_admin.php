<?php
/**
 * Verify admin action password (for protected UI actions).
 * POST { admin_code: string }
 */

header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['POST']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed']);
    exit;
}

require_once '../includes/admin_auth.php';

$payload = json_decode(file_get_contents('php://input'), true);
if (!$payload) {
    $payload = $_POST;
}

$code = $payload['admin_code'] ?? '';

if (!verifyAdminCode($code)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Invalid admin code. Access denied.']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Admin code verified']);

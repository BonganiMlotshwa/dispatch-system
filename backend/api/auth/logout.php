<?php
header('Content-Type: application/json');
require_once '../../includes/cors.php';
cors_headers(['POST']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

require_once '../../includes/auth.php';

auth_logout();

echo json_encode(['success' => true, 'message' => 'Logged out']);



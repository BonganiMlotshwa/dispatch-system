<?php
/**
 * Admin action password — shared by protected APIs.
 * Change ADMIN_ACTION_CODE to your preferred secret.
 */
define('ADMIN_ACTION_CODE', 'FTM2026DELETE');

function verifyAdminCode($code) {
    return is_string($code) && trim($code) === ADMIN_ACTION_CODE;
}

function requireAdminCode(array $payload) {
    $code = $payload['admin_code'] ?? '';
    if (!verifyAdminCode($code)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid admin code. Access denied.']);
        exit;
    }
}

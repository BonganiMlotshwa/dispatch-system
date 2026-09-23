<?php
/**
 * App Settings API
 * GET  — returns all settings (any authenticated user)
 * POST — updates a setting (admin code required)
 */

header('Content-Type: application/json');
require_once '../includes/cors.php';
cors_headers(['GET', 'POST', 'OPTIONS']);
require_once '../includes/auth.php';
auth_require_user();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/admin_auth.php';

$pdo = getDbConnection();

$pdo->exec("CREATE TABLE IF NOT EXISTS app_settings (
    `key`      VARCHAR(64)  NOT NULL PRIMARY KEY,
    `value`    VARCHAR(255) NOT NULL DEFAULT '',
    updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Seed defaults (INSERT IGNORE keeps existing values)
$defaults = [
    'show_label_generator' => '0',
    'show_xml_generator'   => '0',
];
$ins = $pdo->prepare("INSERT IGNORE INTO app_settings (`key`, `value`) VALUES (?, ?)");
foreach ($defaults as $k => $v) {
    $ins->execute([$k, $v]);
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $rows = $pdo->query("SELECT `key`, `value` FROM app_settings")->fetchAll();
    $settings = [];
    foreach ($rows as $r) {
        $settings[$r['key']] = $r['value'];
    }
    echo json_encode(['success' => true, 'settings' => $settings]);
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    requireAdminCode($body);

    $key   = $body['key']   ?? '';
    $value = $body['value'] ?? '';

    if (!array_key_exists($key, $defaults)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Unknown setting key']);
        exit;
    }

    $pdo->prepare(
        "INSERT INTO app_settings (`key`, `value`) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)"
    )->execute([$key, $value]);

    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);

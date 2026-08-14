<?php
/**
 * CORS helper — call cors_headers() at the top of every API endpoint.
 * Sends credentials-aware headers for React clients on port 3000.
 */
function cors_headers(array $methods = ['GET', 'POST', 'OPTIONS']) {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    $allowed = false;
    if ($origin !== '') {
        $host = preg_replace('#^https?://#', '', $origin);
        // Allow any origin serving the React app on port 3000, plus plain localhost
        if (
            preg_match('/:3000$/', $host) ||
            in_array($host, ['localhost', '127.0.0.1'], true)
        ) {
            $allowed = true;
        }
    }

    if ($allowed) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
    } else {
        header('Access-Control-Allow-Origin: *');
    }

    $methodList = implode(', ', array_unique(array_merge($methods, ['OPTIONS'])));
    header('Access-Control-Allow-Methods: ' . $methodList);
    header('Access-Control-Allow-Headers: Content-Type, Authorization, Cache-Control, X-Requested-With');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit(0);
    }
}

<?php
/**
 * CORS helper — call cors_headers() at the top of every API endpoint.
 * Sends credentials-aware headers for React clients on port 3000.
 */
function cors_headers(array $methods = ['GET', 'POST', 'OPTIONS']) {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    // Extra origins for production — set CORS_ALLOWED_ORIGINS in Apache SetEnv
    // or php-fpm pool env as a comma-separated list, e.g. "http://192.168.1.50,https://dispatch.ftm.sz"
    $extraOrigins = array_filter(array_map('trim', explode(',', getenv('CORS_ALLOWED_ORIGINS') ?: '')));

    $allowed = false;
    if ($origin !== '') {
        $host = preg_replace('#^https?://#', '', $origin);
        // Allow React dev server (port 300x), plain localhost, and any configured production origins
        if (
            preg_match('/:300\d$/', $host) ||
            in_array($host, ['localhost', '127.0.0.1'], true) ||
            in_array($origin, $extraOrigins, true)
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

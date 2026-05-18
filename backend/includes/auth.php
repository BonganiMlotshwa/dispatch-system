<?php
/**
 * Authentication helpers: sessions, guards, login rate limiting.
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start([
        'cookie_httponly' => true,
        'cookie_samesite' => 'Lax',
    ]);
}

function auth_get_user() {
    return isset($_SESSION['user']) ? $_SESSION['user'] : null;
}

function auth_require_user() {
    if (!auth_get_user()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit;
    }
}

function auth_login($user) {
    $_SESSION['user'] = [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'email' => $user['email'],
        'role' => $user['role']
    ];
}

function auth_logout() {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

function auth_is_admin() {
    $u = auth_get_user();
    return $u && $u['role'] === 'admin';
}



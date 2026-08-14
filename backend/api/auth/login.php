<?php
header('Content-Type: application/json');
require_once '../../includes/cors.php';
cors_headers(['POST']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed']);
    exit;
}

require_once '../../config/database.php';
require_once '../../includes/auth.php';

try {
    $pdo = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) { $input = $_POST; }

    $username = isset($input['username']) ? trim($input['username']) : '';
    $password = isset($input['password']) ? $input['password'] : '';

    if ($username === '' || $password === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Username and password are required']);
        exit;
    }

    // Fetch user by username or email
    $stmt = $pdo->prepare('SELECT * FROM users WHERE (username = ? OR email = ?) LIMIT 1');
    $stmt->execute([$username, $username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || !$user['is_active']) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
        exit;
    }

    // Check lock status
    if (!empty($user['locked_until']) && strtotime($user['locked_until']) > time()) {
        http_response_code(423);
        echo json_encode(['success' => false, 'message' => 'Account temporarily locked. Please try again later.']);
        exit;
    }

    $valid = password_verify($password, $user['password']);
    if (!$valid) {
        // Increment failed attempts and optionally lock
        $failed = (int)$user['failed_login_attempts'] + 1;
        $lockedUntil = null;
        if ($failed >= 5) {
            $lockedUntil = date('Y-m-d H:i:s', time() + 15 * 60); // lock 15 min
            $failed = 0; // reset counter after lock set
        }
        $stmt = $pdo->prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?');
        $stmt->execute([$failed, $lockedUntil, $user['id']]);

        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
        exit;
    }

    // Reset failed attempts and set last_login
    $stmt = $pdo->prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = ?');
    $stmt->execute([$user['id']]);

    auth_login($user);

    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'user' => [
            'id' => (int)$user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role']
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    $debug = getenv('APP_DEBUG') === '1';
    echo json_encode([
        'success' => false,
        'message' => $debug ? ('Server error: ' . $e->getMessage()) : 'Server error'
    ]);
}



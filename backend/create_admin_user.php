<?php
// CLI/one-time script to create an initial admin user
require_once __DIR__ . '/config/database.php';

try {
    $pdo = getDbConnection();

    $username = getenv('ADMIN_USERNAME') ?: 'admin';
    $email = getenv('ADMIN_EMAIL') ?: 'admin@example.com';
    $password = getenv('ADMIN_PASSWORD') ?: 'ChangeMe!123';

    $hash = password_hash($password, PASSWORD_DEFAULT);

    // Upsert-like behavior: try insert, if exists, update password
    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1');
    $stmt->execute([$username, $email]);
    $existing = $stmt->fetch();

    if ($existing) {
        $stmt = $pdo->prepare('UPDATE users SET password_hash = ?, role = "admin", is_active = 1 WHERE id = ?');
        $stmt->execute([$hash, $existing['id']]);
        echo "Updated existing admin user: {$username}\n";
    } else {
        $stmt = $pdo->prepare('INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, "admin", 1)');
        $stmt->execute([$username, $email, $hash]);
        echo "Created admin user: {$username}\n";
    }

    echo "Username: {$username}\n";
    echo "Email: {$email}\n";
    echo "Password: {$password}\n";
} catch (Exception $e) {
    echo 'Error: ' . $e->getMessage() . "\n";
    exit(1);
}



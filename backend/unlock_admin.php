<?php
require_once __DIR__ . '/config/database.php';

try {
    $pdo = getDbConnection();
    
    $stmt = $pdo->prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE username = ?');
    $stmt->execute(['admin']);
    
    echo "Admin account unlocked successfully!\n";
    echo "You can now login with:\n";
    echo "  Username: admin\n";
    echo "  Password: ChangeMe!123\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

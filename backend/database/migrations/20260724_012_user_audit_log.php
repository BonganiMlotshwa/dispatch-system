<?php
/**
 * Migration: User Audit Log
 * Tracks all user management actions (create, update, delete, role changes)
 */

return static function (PDO $pdo): void {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS user_audit_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            action_by_user_id INT NOT NULL COMMENT 'User who performed the action',
            action_by_username VARCHAR(50) NOT NULL COMMENT 'Username snapshot',
            action_type ENUM('create', 'update', 'delete', 'activate', 'deactivate', 'role_change', 'password_reset') NOT NULL,
            target_user_id INT NULL COMMENT 'User affected by action',
            target_username VARCHAR(50) NULL COMMENT 'Target username snapshot',
            old_value TEXT NULL COMMENT 'JSON of old values',
            new_value TEXT NULL COMMENT 'JSON of new values',
            description TEXT NULL COMMENT 'Human-readable description',
            ip_address VARCHAR(45) NULL COMMENT 'IP address of action',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_action_by_user_id (action_by_user_id),
            KEY idx_target_user_id (target_user_id),
            KEY idx_action_type (action_type),
            KEY idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    echo "user_audit_log table created.\n";
};

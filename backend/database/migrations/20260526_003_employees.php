<?php
return static function (PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `employees` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `employee_code` varchar(20) NOT NULL COMMENT 'Unique employee code for login',
        `employee_name` varchar(100) NOT NULL COMMENT 'Full name of employee',
        `role` enum('scanner','supervisor','admin') NOT NULL DEFAULT 'scanner' COMMENT 'Employee role',
        `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Account active status',
        `last_login` datetime DEFAULT NULL COMMENT 'Last login timestamp',
        `created_at` datetime NOT NULL DEFAULT current_timestamp(),
        `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (`id`),
        UNIQUE KEY `employee_code` (`employee_code`),
        KEY `idx_employee_code` (`employee_code`),
        KEY `idx_is_active` (`is_active`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `employee_sessions` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `employee_id` int(11) NOT NULL COMMENT 'Foreign key to employees',
        `token` varchar(64) NOT NULL COMMENT 'Session token',
        `expires_at` datetime NOT NULL COMMENT 'Session expiration time',
        `created_at` datetime NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (`id`),
        UNIQUE KEY `token` (`token`),
        KEY `employee_id` (`employee_id`),
        KEY `idx_expires_at` (`expires_at`),
        CONSTRAINT `employee_sessions_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Sample employees — INSERT IGNORE is idempotent
    $pdo->exec("INSERT IGNORE INTO `employees` (`employee_code`, `employee_name`, `role`) VALUES
        ('EMP001', 'Mkhaya', 'scanner'),
        ('EMP002', 'Thabo', 'scanner'),
        ('EMP003', 'Sipho', 'scanner'),
        ('ADMIN01', 'Admin User', 'admin')
    ");
};

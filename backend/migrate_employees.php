<?php
/**
 * Migration Script: Add Employee Management Tables
 * 
 * This script adds tables for employee code-based login
 */

require_once 'config/database.php';

try {
    $pdo = getDbConnection();
    
    echo "Starting employee migration...\n\n";
    
    // 1. Create employees table
    echo "Creating employees table...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `employees` (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "✓ employees table created\n\n";
    
    // 2. Create employee_sessions table
    echo "Creating employee_sessions table...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `employee_sessions` (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "✓ employee_sessions table created\n\n";
    
    // 3. Insert sample employees
    echo "Creating sample employees...\n";
    
    $sampleEmployees = [
        ['EMP001', 'Mkhaya', 'scanner'],
        ['EMP002', 'Thabo', 'scanner'],
        ['EMP003', 'Sipho', 'scanner'],
        ['ADMIN01', 'Admin User', 'admin']
    ];
    
    $stmt = $pdo->prepare("
        INSERT IGNORE INTO employees (employee_code, employee_name, role) 
        VALUES (?, ?, ?)
    ");
    
    foreach ($sampleEmployees as $emp) {
        $stmt->execute($emp);
        echo "  - Created employee: {$emp[1]} (Code: {$emp[0]})\n";
    }
    
    echo "\n===========================================\n";
    echo "Migration completed successfully!\n";
    echo "===========================================\n\n";
    echo "Sample Employee Codes:\n";
    echo "  EMP001 - Mkhaya (Scanner)\n";
    echo "  EMP002 - Thabo (Scanner)\n";
    echo "  EMP003 - Sipho (Scanner)\n";
    echo "  ADMIN01 - Admin User (Admin)\n\n";
    echo "Use these codes to login as warehouse employees.\n";
    echo "Only the employee name will be displayed in 'Scanned by' column.\n\n";
    
} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

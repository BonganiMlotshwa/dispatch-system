<?php
/**
 * Migration Script: Add Truck Shipment Tables
 * 
 * This script adds tables for tracking truck shipments and scan audit trail
 */

require_once __DIR__ . '/config/database.php';

try {
    $pdo = getDbConnection();
    
    echo "Starting migration...\n\n";
    
    // 1. Create truck_shipments table
    echo "Creating truck_shipments table...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `truck_shipments` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `shipment_date` date NOT NULL COMMENT 'Date of shipment',
            `shipment_week` varchar(10) DEFAULT NULL COMMENT 'Week number (e.g., Wk16)',
            `truck_reg` varchar(50) NOT NULL COMMENT 'Truck registration number',
            `driver_name` varchar(100) DEFAULT NULL COMMENT 'Driver name',
            `remarks` text DEFAULT NULL COMMENT 'Remarks (e.g., shipment incomplete)',
            `created_at` datetime NOT NULL DEFAULT current_timestamp(),
            `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
            PRIMARY KEY (`id`),
            KEY `idx_shipment_date` (`shipment_date`),
            KEY `idx_truck_reg` (`truck_reg`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "✓ truck_shipments table created\n\n";
    
    // 2. Create truck_shipment_items table
    echo "Creating truck_shipment_items table...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `truck_shipment_items` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `truck_shipment_id` int(11) NOT NULL COMMENT 'Foreign key to truck_shipments',
            `shipment_id` int(11) NOT NULL COMMENT 'Foreign key to shipments (PO)',
            `cartons_shipped` int(11) NOT NULL DEFAULT 0 COMMENT 'Number of cartons shipped',
            `units_shipped` int(11) NOT NULL DEFAULT 0 COMMENT 'Number of units shipped',
            `created_at` datetime NOT NULL DEFAULT current_timestamp(),
            PRIMARY KEY (`id`),
            KEY `truck_shipment_id` (`truck_shipment_id`),
            KEY `shipment_id` (`shipment_id`),
            CONSTRAINT `truck_shipment_items_ibfk_1` FOREIGN KEY (`truck_shipment_id`) REFERENCES `truck_shipments` (`id`) ON DELETE CASCADE,
            CONSTRAINT `truck_shipment_items_ibfk_2` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "✓ truck_shipment_items table created\n\n";
    
    // 3. Add scanned_by column to cartons table
    echo "Adding scanned_by and scan_type columns to cartons table...\n";
    
    // Check if scanned_by column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM cartons LIKE 'scanned_by'");
    if ($stmt->rowCount() == 0) {
        $pdo->exec("
            ALTER TABLE cartons 
            ADD COLUMN `scanned_by` varchar(100) DEFAULT NULL COMMENT 'User who scanned the carton' AFTER scan_timestamp
        ");
        echo "✓ scanned_by column added\n";
    } else {
        echo "- scanned_by column already exists\n";
    }
    
    // Check if scan_type column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM cartons LIKE 'scan_type'");
    if ($stmt->rowCount() == 0) {
        $pdo->exec("
            ALTER TABLE cartons 
            ADD COLUMN `scan_type` enum('entry','exit') DEFAULT NULL COMMENT 'Type of scan (entry/exit)' AFTER scanned_by
        ");
        echo "✓ scan_type column added\n";
    } else {
        echo "- scan_type column already exists\n";
    }
    
    // 4. Create scan_audit_log table
    echo "\nCreating scan_audit_log table...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `scan_audit_log` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `carton_id` int(11) NOT NULL COMMENT 'Foreign key to cartons',
            `scan_type` enum('entry','exit') NOT NULL COMMENT 'Type of scan',
            `scan_timestamp` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'When the scan occurred',
            `scanned_by` varchar(100) DEFAULT NULL COMMENT 'User who performed the scan',
            `previous_status` enum('pending','entered','exited') DEFAULT NULL COMMENT 'Status before scan',
            `new_status` enum('pending','entered','exited') NOT NULL COMMENT 'Status after scan',
            `notes` text DEFAULT NULL COMMENT 'Additional notes',
            PRIMARY KEY (`id`),
            KEY `carton_id` (`carton_id`),
            KEY `idx_scan_timestamp` (`scan_timestamp`),
            KEY `idx_scan_type` (`scan_type`),
            CONSTRAINT `scan_audit_log_ibfk_1` FOREIGN KEY (`carton_id`) REFERENCES `cartons` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "✓ scan_audit_log table created\n\n";
    
    echo "===========================================\n";
    echo "Migration completed successfully!\n";
    echo "===========================================\n\n";
    echo "New features added:\n";
    echo "1. Truck shipment management\n";
    echo "2. Scan audit trail with user tracking\n";
    echo "3. Entry/Exit scan differentiation\n";
    echo "4. Scan count feature support\n\n";
    
} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

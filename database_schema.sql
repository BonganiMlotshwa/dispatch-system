-- ============================================
-- FTM Garments Warehouse Tracking System
-- Complete Database Schema
-- ============================================
-- This schema includes all tables with the latest updates
-- including multi-customer support (OTB/OBSW)
-- ============================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS `warehouse_tracking` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `warehouse_tracking`;

-- ============================================
-- Table: shipments
-- Stores shipment/PO information
-- ============================================
CREATE TABLE IF NOT EXISTS `shipments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `internal_po_number` varchar(100) NOT NULL COMMENT 'Internal PO number (unique identifier)',
  `customer` varchar(50) DEFAULT 'MRP' COMMENT 'Customer name (MRP, OTB, OBSW, etc.)',
  `file_name` varchar(255) NOT NULL COMMENT 'Original XML filename or manual entry identifier',
  `import_date` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Date when shipment was imported/created',
  `style` varchar(100) DEFAULT NULL COMMENT 'Product style',
  `color` varchar(50) DEFAULT NULL COMMENT 'Product color',
  `order_qty` int(11) DEFAULT NULL COMMENT 'Total order quantity',
  `entry_type` enum('xml','manual') DEFAULT 'xml' COMMENT 'How the shipment was created',
  `warehouse_order_status` varchar(50) NOT NULL DEFAULT 'active' COMMENT 'Spec 1.5: active, shipped, cancelled, not_audited, failed_audit, waiting_for_booking',
  `quantity` int(11) DEFAULT NULL COMMENT 'Legacy quantity field',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `internal_po_number` (`internal_po_number`),
  KEY `idx_customer` (`customer`),
  KEY `idx_import_date` (`import_date`),
  KEY `idx_entry_type` (`entry_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table: cartons
-- Stores individual carton information
-- ============================================
CREATE TABLE IF NOT EXISTS `cartons` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `shipment_id` int(11) NOT NULL COMMENT 'Foreign key to shipments table',
  `po_number` varchar(50) DEFAULT NULL COMMENT 'Customer order number',
  `pre_pack_id` varchar(50) DEFAULT NULL COMMENT 'PrePackId from XML',
  `barcode_2d` varchar(100) NOT NULL COMMENT 'Unique carton barcode for scanning',
  `size` varchar(20) DEFAULT NULL COMMENT 'Size information',
  `units` int(11) DEFAULT NULL COMMENT 'Number of units in carton',
  `item` varchar(100) DEFAULT NULL COMMENT 'Item information',
  `transfer_number` varchar(50) DEFAULT NULL COMMENT 'Transfer number from XML',
  `transfer_number_end_four` varchar(20) DEFAULT NULL COMMENT 'Last four characters of transfer number',
  `sequence_number` varchar(50) DEFAULT NULL COMMENT 'Sequence number from XML',
  `heading` varchar(50) DEFAULT NULL COMMENT 'Heading from XML',
  `division` varchar(50) DEFAULT NULL COMMENT 'Division information from XML',
  `reserve_or_xdock` varchar(20) DEFAULT NULL COMMENT 'Reserve or Xdock status from XML',
  `total_sequence_number` varchar(20) DEFAULT NULL COMMENT 'Total sequence number from XML',
  `wave_category` varchar(50) DEFAULT NULL COMMENT 'Wave category from XML',
  `print_date` varchar(20) DEFAULT NULL COMMENT 'Print date from XML',
  `depot_store_code` varchar(20) DEFAULT NULL COMMENT 'Depot store code from XML',
  `qc_number` varchar(50) DEFAULT NULL COMMENT 'Manually entered QC number',
  `finishing_number` varchar(50) DEFAULT NULL COMMENT 'Manually entered finishing number',
  `status` enum('pending','entered','exited') NOT NULL DEFAULT 'pending' COMMENT 'Current status of carton',
  `scan_timestamp` datetime DEFAULT NULL COMMENT 'Timestamp of last scan activity',
  `entry_timestamp` datetime DEFAULT NULL COMMENT 'When carton entered warehouse',
  `exit_timestamp` datetime DEFAULT NULL COMMENT 'When carton exited warehouse',
  `notes` text DEFAULT NULL COMMENT 'Additional notes or comments',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `barcode_2d` (`barcode_2d`),
  KEY `shipment_id` (`shipment_id`),
  KEY `idx_status` (`status`),
  KEY `idx_scan_timestamp` (`scan_timestamp`),
  KEY `idx_po_number` (`po_number`),
  CONSTRAINT `cartons_ibfk_1` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table: users
-- Stores user authentication information
-- ============================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL COMMENT 'Unique username',
  `password` varchar(255) NOT NULL COMMENT 'Hashed password',
  `role` enum('admin','user','viewer') NOT NULL DEFAULT 'user' COMMENT 'User role',
  `full_name` varchar(100) DEFAULT NULL COMMENT 'Full name of user',
  `email` varchar(100) DEFAULT NULL COMMENT 'Email address',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Account active status',
  `last_login` datetime DEFAULT NULL COMMENT 'Last login timestamp',
  `failed_login_attempts` int(11) NOT NULL DEFAULT 0 COMMENT 'Number of failed login attempts',
  `locked_until` datetime DEFAULT NULL COMMENT 'Account locked until this time',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_username` (`username`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Insert default admin user
-- Username: admin
-- Password: admin123
-- ============================================
INSERT INTO `users` (`username`, `password`, `role`, `full_name`, `is_active`) VALUES
('admin', '$2y$10$YourHashedPasswordHere', 'admin', 'System Administrator', 1)
ON DUPLICATE KEY UPDATE `username` = `username`;

-- Note: You should run backend/create_admin_user.php to create the admin user with proper password hashing

COMMIT;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
-- These indexes are already created above, but listed here for reference:
-- 
-- shipments table:
--   - PRIMARY KEY on id
--   - UNIQUE KEY on internal_po_number
--   - INDEX on customer (for filtering by customer)
--   - INDEX on import_date (for date-based queries)
--   - INDEX on entry_type (for filtering manual vs XML entries)
--
-- cartons table:
--   - PRIMARY KEY on id
--   - UNIQUE KEY on barcode_2d (for barcode lookups)
--   - FOREIGN KEY on shipment_id
--   - INDEX on status (for status filtering)
--   - INDEX on scan_timestamp (for daily summary reports)
--   - INDEX on po_number (for PO searches)
--
-- users table:
--   - PRIMARY KEY on id
--   - UNIQUE KEY on username
--   - INDEX on username (for login queries)
--   - INDEX on is_active (for active user filtering)
-- ============================================

-- ============================================
-- NOTES:
-- ============================================
-- 1. This schema supports multi-customer operations (MRP, OTB, OBSW)
-- 2. Shipments can be created via XML import or manual entry
-- 3. Cartons track their status: pending → entered → exited
-- 4. scan_timestamp records when cartons are physically received
-- 5. The system supports QC and finishing number tracking
-- 6. User authentication includes account locking after failed attempts
-- ============================================


-- ============================================
-- LEGACY WAREHOUSE GOODS (prior-year stock still inside)
-- ============================================
CREATE TABLE IF NOT EXISTS `legacy_warehouse_goods` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `internal_po` varchar(50) NOT NULL COMMENT 'FTM PO e.g. FTM-15730',
  `customer_order_number` varchar(50) DEFAULT NULL,
  `customer` varchar(50) DEFAULT 'MRP',
  `customer_other` varchar(100) DEFAULT NULL COMMENT 'Custom customer name when customer = Other',
  `style` varchar(200) DEFAULT NULL,
  `color` varchar(100) DEFAULT NULL,
  `order_qty` int(11) DEFAULT NULL,
  `quantity_inside` int(11) DEFAULT NULL,
  `cartons_label` varchar(50) DEFAULT NULL,
  `cartons_count` int(11) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `remarks` text DEFAULT NULL,
  `new_developments` text DEFAULT NULL,
  `shipped_qty` int(11) DEFAULT 0,
  `source_year` smallint(6) DEFAULT 2025,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_internal_po` (`internal_po`),
  KEY `idx_customer` (`customer`),
  KEY `idx_source_year` (`source_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TRUCK SHIPMENT TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS `truck_shipments` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `shipment_date` date NOT NULL COMMENT 'Date of shipment',
    `shipment_week` varchar(10) DEFAULT NULL COMMENT 'Week number (e.g., Wk16)',
    `truck_reg` varchar(50) NOT NULL COMMENT 'Truck registration number',
    `driver_name` varchar(100) DEFAULT NULL COMMENT 'Driver name',
    `remarks` text DEFAULT NULL COMMENT 'Remarks (e.g., shipment incomplete)',
    `loading_status` enum('open','closed') NOT NULL DEFAULT 'open' COMMENT 'open = loading in progress, closed = finished',
    `created_at` datetime NOT NULL DEFAULT current_timestamp(),
    `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    KEY `idx_shipment_date` (`shipment_date`),
    KEY `idx_truck_reg` (`truck_reg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- EMPLOYEE MANAGEMENT TABLES
-- ============================================

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SCAN AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS `scan_audit_log` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `carton_id` int(11) NOT NULL COMMENT 'Foreign key to cartons',
    `scan_type` enum('entry','exit') NOT NULL COMMENT 'Type of scan',
    `scan_timestamp` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'When the scan occurred',
    `scanned_by` varchar(100) DEFAULT NULL COMMENT 'User who performed the scan',
    `truck_shipment_id` int(11) DEFAULT NULL COMMENT 'Truck shipment for exit scans',
    `previous_status` enum('pending','entered','exited') DEFAULT NULL COMMENT 'Status before scan',
    `new_status` enum('pending','entered','exited') NOT NULL COMMENT 'Status after scan',
    `notes` text DEFAULT NULL COMMENT 'Additional notes',
    PRIMARY KEY (`id`),
    KEY `carton_id` (`carton_id`),
    KEY `idx_scan_timestamp` (`scan_timestamp`),
    KEY `idx_scan_type` (`scan_type`),
    CONSTRAINT `scan_audit_log_ibfk_1` FOREIGN KEY (`carton_id`) REFERENCES `cartons` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- UPDATE CARTONS TABLE FOR DRIVER WORKFLOW
-- ============================================

ALTER TABLE `cartons` 
ADD COLUMN IF NOT EXISTS `scanned_by` varchar(100) DEFAULT NULL COMMENT 'User who scanned the carton' AFTER `scan_timestamp`,
ADD COLUMN IF NOT EXISTS `scan_type` enum('entry','exit') DEFAULT NULL COMMENT 'Type of scan (entry/exit)' AFTER `scanned_by`,
ADD COLUMN IF NOT EXISTS `truck_shipment_id` int(11) DEFAULT NULL COMMENT 'Link to truck shipment for exit scans' AFTER `scan_type`,
ADD KEY IF NOT EXISTS `idx_truck_shipment_id` (`truck_shipment_id`);

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Insert sample employees
INSERT IGNORE INTO `employees` (`employee_code`, `employee_name`, `role`) VALUES
('EMP001', 'Mkhaya', 'scanner'),
('EMP002', 'Thabo', 'scanner'),
('EMP003', 'Sipho', 'scanner'),
('ADMIN01', 'Admin User', 'admin');

COMMIT;

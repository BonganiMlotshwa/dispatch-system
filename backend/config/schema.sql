-- Database schema for Warehouse Carton Tracking System

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS warehouse_tracking;

-- Use the database
USE warehouse_tracking;

-- Create shipments table
CREATE TABLE IF NOT EXISTS shipments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    internal_po_number VARCHAR(50) NOT NULL COMMENT 'User-defined internal PO number (e.g., FTM-12554)',
    file_name VARCHAR(255) NOT NULL COMMENT 'Original imported file name',
    import_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date and time of import',
    style VARCHAR(100) COMMENT 'Style information',
    color VARCHAR(100) COMMENT 'Color information',
    quantity VARCHAR(50) COMMENT 'Quantity information',
    UNIQUE KEY (internal_po_number, file_name) COMMENT 'Prevent duplicate file imports for same PO'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create cartons table
CREATE TABLE IF NOT EXISTS cartons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shipment_id INT NOT NULL COMMENT 'Foreign key to shipments table',
    po_number VARCHAR(50) COMMENT 'Customer order number from XML',
    pre_pack_id VARCHAR(50) COMMENT 'PrePackId from XML',
    barcode_2d VARCHAR(100) NOT NULL COMMENT 'Unique carton barcode for scanning',
    size VARCHAR(20) COMMENT 'Size information',
    units INT COMMENT 'Number of units in carton',
    item VARCHAR(100) COMMENT 'Item information',
    transfer_number VARCHAR(50) COMMENT 'Transfer number from XML',
    transfer_number_end_four VARCHAR(20) COMMENT 'Last four characters of transfer number',
    sequence_number VARCHAR(50) COMMENT 'Sequence number from XML',
    heading VARCHAR(50) COMMENT 'Heading from XML',
    division VARCHAR(50) COMMENT 'Division information from XML',
    reserve_or_xdock VARCHAR(20) COMMENT 'Reserve or Xdock status from XML',
    total_sequence_number VARCHAR(20) COMMENT 'Total sequence number from XML',
    wave_category VARCHAR(50) COMMENT 'Wave category from XML',
    print_date VARCHAR(20) COMMENT 'Print date from XML',
    depot_store_code VARCHAR(20) COMMENT 'Depot store code from XML',
    qc_number VARCHAR(50) COMMENT 'Manually entered QC number',
    finishing_number VARCHAR(50) COMMENT 'Manually entered finishing number',
    status ENUM('pending', 'entered', 'exited') NOT NULL DEFAULT 'pending' COMMENT 'Current status of carton',
    scan_timestamp DATETIME COMMENT 'Timestamp of last scan',
    entry_timestamp DATETIME DEFAULT NULL COMMENT 'When carton entered warehouse',
    exit_timestamp DATETIME DEFAULT NULL COMMENT 'When carton exited warehouse',
    notes TEXT COMMENT 'Additional notes or comments',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
    UNIQUE KEY (barcode_2d) COMMENT 'Ensure each barcode is unique'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index for barcode_2d already exists as a UNIQUE KEY constraint

-- Index for status filtering
-- Note: This index may already exist if the database was previously initialized

-- Index for shipment relationship
-- Note: This index may already exist if the database was previously initialized

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','user') NOT NULL DEFAULT 'user',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,
    last_login DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Database optimization indexes for better performance
-- Run this script to add indexes that will speed up common queries

-- Indexes for cartons table (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_cartons_shipment_id ON cartons(shipment_id);
CREATE INDEX IF NOT EXISTS idx_cartons_status ON cartons(status);
CREATE INDEX IF NOT EXISTS idx_cartons_scan_timestamp ON cartons(scan_timestamp);
CREATE INDEX IF NOT EXISTS idx_cartons_updated_at ON cartons(updated_at);
CREATE INDEX IF NOT EXISTS idx_cartons_size ON cartons(size);
CREATE INDEX IF NOT EXISTS idx_cartons_qc_number ON cartons(qc_number);
CREATE INDEX IF NOT EXISTS idx_cartons_finishing_number ON cartons(finishing_number);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_cartons_shipment_status ON cartons(shipment_id, status);
CREATE INDEX IF NOT EXISTS idx_cartons_status_timestamp ON cartons(status, scan_timestamp);
CREATE INDEX IF NOT EXISTS idx_cartons_shipment_updated ON cartons(shipment_id, updated_at);

-- Indexes for shipments table
CREATE INDEX IF NOT EXISTS idx_shipments_import_date ON shipments(import_date);
CREATE INDEX IF NOT EXISTS idx_shipments_internal_po ON shipments(internal_po_number);

-- Show current table sizes and index usage
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS 'Size (MB)',
    ROUND((INDEX_LENGTH / 1024 / 1024), 2) AS 'Index Size (MB)'
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'warehouse_tracking'
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;
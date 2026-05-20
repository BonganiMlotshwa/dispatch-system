-- Add customer support to the warehouse tracking system

-- Add customer column to shipments table
ALTER TABLE `shipments` 
ADD COLUMN `customer` VARCHAR(50) NOT NULL DEFAULT 'MRP' COMMENT 'Customer name (MRP, OTB, OBSW, etc.)' AFTER `internal_po_number`;

-- Add additional fields for manual entry
ALTER TABLE `shipments`
ADD COLUMN `style` VARCHAR(100) DEFAULT NULL COMMENT 'Style information',
ADD COLUMN `color` VARCHAR(50) DEFAULT NULL COMMENT 'Color information',
ADD COLUMN `order_qty` INT DEFAULT NULL COMMENT 'Total order quantity',
ADD COLUMN `entry_type` ENUM('xml', 'manual') NOT NULL DEFAULT 'xml' COMMENT 'How the shipment was created';

-- Update existing records to have MRP as customer
UPDATE `shipments` SET `customer` = 'MRP' WHERE `customer` = 'MRP';

-- Create index for faster customer queries
CREATE INDEX `idx_customer` ON `shipments` (`customer`);
CREATE INDEX `idx_entry_type` ON `shipments` (`entry_type`);

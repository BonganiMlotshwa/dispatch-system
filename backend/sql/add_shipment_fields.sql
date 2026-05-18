-- Migration script to add style, color, and quantity fields to shipments table
-- Run this if you have an existing database

USE warehouse_tracking;

-- Add style column if it doesn't exist
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS style VARCHAR(100) COMMENT 'Style information';

-- Add color column if it doesn't exist
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS color VARCHAR(100) COMMENT 'Color information';

-- Add quantity column if it doesn't exist
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS quantity VARCHAR(50) COMMENT 'Quantity information';

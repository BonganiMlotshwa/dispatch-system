<?php
/**
 * Migration: Add customer_other field to legacy_warehouse_goods table
 * 
 * Adds a new column to allow custom customer names when "Other" is selected
 */

require_once __DIR__ . '/config/database.php';

echo "=== Migration: Add customer_other field ===\n\n";

try {
    $pdo = getDbConnection();
    
    // Check if column already exists
    $stmt = $pdo->query("SHOW COLUMNS FROM legacy_warehouse_goods LIKE 'customer_other'");
    $columnExists = $stmt->fetch();
    
    if ($columnExists) {
        echo "✓ Column 'customer_other' already exists. Skipping migration.\n";
        exit(0);
    }
    
    // Add the customer_other column
    echo "Adding 'customer_other' column to legacy_warehouse_goods table...\n";
    $pdo->exec("
        ALTER TABLE legacy_warehouse_goods 
        ADD COLUMN customer_other varchar(100) DEFAULT NULL 
        COMMENT 'Custom customer name when customer = Other'
        AFTER customer
    ");
    
    echo "✓ Migration completed successfully!\n";
    echo "\nThe 'customer_other' field has been added to the legacy_warehouse_goods table.\n";
    echo "Users can now enter custom customer names when selecting 'Other' from the dropdown.\n";
    
} catch (Exception $e) {
    echo "✗ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}

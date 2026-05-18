<?php
/**
 * Migration script to add customer support
 * Run this once to update the database schema
 */

require_once __DIR__ . '/config/database.php';

try {
    $pdo = getDbConnection();
    
    echo "Starting migration...\n\n";
    
    // Check if customer column already exists
    $stmt = $pdo->query("SHOW COLUMNS FROM shipments LIKE 'customer'");
    if ($stmt->rowCount() > 0) {
        echo "✓ Customer column already exists\n";
    } else {
        echo "Adding customer column...\n";
        $pdo->exec("ALTER TABLE `shipments` 
            ADD COLUMN `customer` VARCHAR(50) NOT NULL DEFAULT 'MRP' COMMENT 'Customer name (MRP, OTB, OBSW, etc.)' AFTER `internal_po_number`");
        echo "✓ Customer column added\n";
    }
    
    // Check if style column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM shipments LIKE 'style'");
    if ($stmt->rowCount() > 0) {
        echo "✓ Style column already exists\n";
    } else {
        echo "Adding style column...\n";
        $pdo->exec("ALTER TABLE `shipments`
            ADD COLUMN `style` VARCHAR(100) DEFAULT NULL COMMENT 'Style information'");
        echo "✓ Style column added\n";
    }
    
    // Check if color column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM shipments LIKE 'color'");
    if ($stmt->rowCount() > 0) {
        echo "✓ Color column already exists\n";
    } else {
        echo "Adding color column...\n";
        $pdo->exec("ALTER TABLE `shipments`
            ADD COLUMN `color` VARCHAR(50) DEFAULT NULL COMMENT 'Color information'");
        echo "✓ Color column added\n";
    }
    
    // Check if order_qty column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM shipments LIKE 'order_qty'");
    if ($stmt->rowCount() > 0) {
        echo "✓ Order quantity column already exists\n";
    } else {
        echo "Adding order quantity column...\n";
        $pdo->exec("ALTER TABLE `shipments`
            ADD COLUMN `order_qty` INT DEFAULT NULL COMMENT 'Total order quantity'");
        echo "✓ Order quantity column added\n";
    }
    
    // Check if entry_type column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM shipments LIKE 'entry_type'");
    if ($stmt->rowCount() > 0) {
        echo "✓ Entry type column already exists\n";
    } else {
        echo "Adding entry type column...\n";
        $pdo->exec("ALTER TABLE `shipments`
            ADD COLUMN `entry_type` ENUM('xml', 'manual') NOT NULL DEFAULT 'xml' COMMENT 'How the shipment was created'");
        echo "✓ Entry type column added\n";
    }
    
    // Update existing records
    echo "Updating existing records...\n";
    $pdo->exec("UPDATE `shipments` SET `customer` = 'MRP', `entry_type` = 'xml' WHERE `customer` = 'MRP'");
    echo "✓ Existing records updated\n";
    
    // Create indexes
    echo "Creating indexes...\n";
    try {
        $pdo->exec("CREATE INDEX `idx_customer` ON `shipments` (`customer`)");
        echo "✓ Customer index created\n";
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate key name') !== false) {
            echo "✓ Customer index already exists\n";
        } else {
            throw $e;
        }
    }
    
    try {
        $pdo->exec("CREATE INDEX `idx_entry_type` ON `shipments` (`entry_type`)");
        echo "✓ Entry type index created\n";
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate key name') !== false) {
            echo "✓ Entry type index already exists\n";
        } else {
            throw $e;
        }
    }
    
    echo "\n✅ Migration completed successfully!\n";
    echo "\nYou can now:\n";
    echo "1. Use the Manual Entry page to add data for other customers\n";
    echo "2. View the Daily Summary report\n";
    echo "3. Continue using XML imports for MRP customer\n";
    
} catch (Exception $e) {
    echo "\n❌ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}

<?php
/**
 * Migration Script: Add Driver Workflow Support
 * Links cartons to truck shipments for exit scans
 */

require_once 'config/database.php';

try {
    $pdo = getDbConnection();
    
    echo "Starting driver workflow migration...\n\n";
    
    // 1. Add truck_shipment_id to cartons table
    echo "Adding truck_shipment_id to cartons table...\n";
    
    $stmt = $pdo->query("SHOW COLUMNS FROM cartons LIKE 'truck_shipment_id'");
    if ($stmt->rowCount() == 0) {
        $pdo->exec("
            ALTER TABLE cartons 
            ADD COLUMN truck_shipment_id INT(11) DEFAULT NULL 
            COMMENT 'Link to truck shipment for exit scans' 
            AFTER scan_type
        ");
        echo "✓ truck_shipment_id column added to cartons\n";
    } else {
        echo "- truck_shipment_id column already exists in cartons\n";
    }
    
    // Add index
    $pdo->exec("
        ALTER TABLE cartons 
        ADD KEY IF NOT EXISTS idx_truck_shipment_id (truck_shipment_id)
    ");
    echo "✓ Index added\n\n";
    
    // 2. Add truck_shipment_id to scan_audit_log table
    echo "Adding truck_shipment_id to scan_audit_log table...\n";
    
    $stmt = $pdo->query("SHOW COLUMNS FROM scan_audit_log LIKE 'truck_shipment_id'");
    if ($stmt->rowCount() == 0) {
        $pdo->exec("
            ALTER TABLE scan_audit_log 
            ADD COLUMN truck_shipment_id INT(11) DEFAULT NULL 
            COMMENT 'Truck shipment for exit scans' 
            AFTER scanned_by
        ");
        echo "✓ truck_shipment_id column added to scan_audit_log\n";
    } else {
        echo "- truck_shipment_id column already exists in scan_audit_log\n";
    }
    
    echo "\n===========================================\n";
    echo "Driver workflow migration completed!\n";
    echo "===========================================\n\n";
    echo "New features:\n";
    echo "- Cartons can be linked to truck shipments\n";
    echo "- Exit scans require truck selection\n";
    echo "- Complete driver accountability\n\n";
    
} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

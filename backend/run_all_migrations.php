<?php
/**
 * Master Migration Script
 * Runs all migrations in the correct order
 */

echo "========================================\n";
echo "FTM Warehouse - Master Migration Script\n";
echo "========================================\n\n";

$migrations = [
    __DIR__ . '/migrate_customer_support.php' => 'Customer Support (Otto, OBSW)',
    __DIR__ . '/migrate_truck_shipments.php' => 'Truck Shipments & Audit Trail',
    __DIR__ . '/migrate_employees.php' => 'Employee Management',
    __DIR__ . '/migrate_driver_workflow.php' => 'Driver Workflow Integration'
];

$success = 0;
$failed = 0;

foreach ($migrations as $file => $description) {
    echo "Running: $description\n";
    echo str_repeat('-', 50) . "\n";
    
    if (file_exists($file)) {
        ob_start();
        try {
            include $file;
            $output = ob_get_clean();
            echo $output;
            $success++;
        } catch (Exception $e) {
            $output = ob_get_clean();
            echo $output;
            echo "ERROR: " . $e->getMessage() . "\n";
            $failed++;
        }
    } else {
        echo "WARNING: Migration file not found: $file\n";
        $failed++;
    }
    
    echo "\n";
}

echo "========================================\n";
echo "Migration Summary\n";
echo "========================================\n";
echo "Successful: $success\n";
echo "Failed: $failed\n";
echo "========================================\n\n";

if ($failed === 0) {
    echo "✓ All migrations completed successfully!\n\n";
    echo "Next steps:\n";
    echo "1. Update your React Router with new routes\n";
    echo "2. Add menu items to sidebar\n";
    echo "3. Test all features\n\n";
} else {
    echo "⚠ Some migrations failed. Please check the errors above.\n\n";
}

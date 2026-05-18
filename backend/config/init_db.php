<?php
/**
 * Database Initialization Script
 * 
 * This script initializes the database schema for the Warehouse Carton Tracking System.
 * Run this script once to set up the database tables.
 */

// Include database configuration
require_once 'database.php';

// Function to initialize database
function initializeDatabase() {
    try {
        // Create a temporary connection without specifying the database
        $tempDsn = "mysql:host=" . DB_HOST . ";charset=utf8mb4";
        $pdo = new PDO($tempDsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
        ]);
        
        // Create database if it doesn't exist
        $pdo->exec("CREATE DATABASE IF NOT EXISTS " . DB_NAME . 
                   " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        
        echo "Database '" . DB_NAME . "' created or already exists.\n";
        
        // Switch to the database
        $pdo->exec("USE " . DB_NAME);
        
        // Check if tables already exist
        $tablesExist = false;
        try {
            $result = $pdo->query("SHOW TABLES LIKE 'shipments'")->fetchAll();
            $tablesExist = (count($result) > 0);
        } catch (PDOException $e) {
            // Table doesn't exist or other error
        }
        
        if ($tablesExist) {
            echo "Tables already exist. Skipping schema creation.\n";
        } else {
            // Read and execute the SQL schema file
            $sql = file_get_contents(__DIR__ . '/schema.sql');
            
            // Split SQL statements and execute them individually
            $statements = explode(';', $sql);
            foreach ($statements as $statement) {
                $statement = trim($statement);
                if (!empty($statement)) {
                    try {
                        $pdo->exec($statement);
                    } catch (PDOException $e) {
                        // Skip errors for duplicate keys or tables
                        if (strpos($e->getMessage(), '1061') === false && strpos($e->getMessage(), '1050') === false) {
                            throw $e;
                        }
                        echo "Notice: " . $e->getMessage() . "\n";
                    }
                }
            }
        }
        
        echo "Database schema initialized successfully.\n";
        return true;
    } catch (PDOException $e) {
        echo "Database initialization failed: " . $e->getMessage() . "\n";
        return false;
    }
}

// Run the initialization
if (initializeDatabase()) {
    echo "Database setup completed successfully.\n";
} else {
    echo "Database setup failed. Please check the error messages above.\n";
}
<?php
/**
 * Warehouse Carton Tracking System - Backend API
 * 
 * This file serves as the main entry point for the backend API.
 */

// Set headers for API response
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, DELETE, PUT');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Check if database configuration exists
if (!file_exists(__DIR__ . '/config/database.php')) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database configuration not found'
    ]);
    exit;
}

// Include database configuration
require_once __DIR__ . '/config/database.php';

try {
    // Test database connection
    $pdo = getDbConnection();
    
    // Get API endpoints
    $endpoints = [
        'upload' => '/api/upload.php - Upload and process XML files',
        'scan' => '/api/scan.php - Scan cartons for entry/exit',
        'update_carton' => '/api/update_carton.php - Update carton data (QC, Finishing numbers)',
        'dashboard' => '/api/dashboard.php - Get dashboard summary data',
        'shipments' => '/api/shipments.php - Get shipment details and carton data',
        'search' => '/api/search.php - Search for cartons by barcode or other criteria'
    ];
    
    // Return API information
    echo json_encode([
        'success' => true,
        'message' => 'Warehouse Carton Tracking System API',
        'version' => '1.0.0',
        'database_connected' => true,
        'endpoints' => $endpoints
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed',
        'error' => 'Please run the database initialization script: /config/init_db.php'
    ]);
}
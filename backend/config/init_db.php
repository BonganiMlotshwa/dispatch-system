<?php
/**
 * Database bootstrap: creates the warehouse_tracking database then runs all
 * tracked migrations. Idempotent — safe to re-run on an existing database.
 *
 * Usage:
 *   php backend/config/init_db.php
 */

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/../database/migrate.php';

try {
    $tempPdo = new PDO(
        'mysql:host=' . DB_HOST . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $tempPdo->exec(
        'CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '`
         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    echo "Database '" . DB_NAME . "' created or already exists.\n\n";
} catch (PDOException $e) {
    echo "Failed to create database: " . $e->getMessage() . "\n";
    exit(1);
}

runDatabaseMigrations();

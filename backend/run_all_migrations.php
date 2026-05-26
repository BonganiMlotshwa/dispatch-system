<?php
/**
 * Backward-compatible wrapper for the tracked migration runner.
 */

require_once __DIR__ . '/database/migrate.php';

runDatabaseMigrations();

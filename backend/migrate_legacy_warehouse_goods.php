<?php
/**
 * Creates legacy_warehouse_goods table.
 * php backend/migrate_legacy_warehouse_goods.php
 */
require_once __DIR__ . '/config/database.php';

$pdo = getDbConnection();
$sql = file_get_contents(__DIR__ . '/sql/legacy_warehouse_goods.sql');
$pdo->exec($sql);
echo "legacy_warehouse_goods table ready.\n";

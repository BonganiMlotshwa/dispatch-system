<?php
/**
 * Align legacy_warehouse_goods.status values to spec 1.5.
 * php backend/migrate_legacy_status_spec15.php
 */
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/legacy_warehouse_statuses.php';

$pdo = getDbConnection();
$stmt = $pdo->query('SELECT id, status FROM legacy_warehouse_goods');
$updated = 0;
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $new = normalizeLegacyWarehouseStatus($row['status']);
    if ($new !== $row['status']) {
        $u = $pdo->prepare('UPDATE legacy_warehouse_goods SET status = ? WHERE id = ?');
        $u->execute([$new, $row['id']]);
        $updated++;
    }
}
echo "Updated {$updated} row(s) to spec 1.5 statuses.\n";

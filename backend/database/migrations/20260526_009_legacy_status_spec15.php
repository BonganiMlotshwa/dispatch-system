<?php
return static function (PDO $pdo): void {
    // Normalize legacy status values to spec 1.5 canonical set
    $map = [
        'in_warehouse'              => 'active',
        'shipped_complete'          => 'shipped',
        'partial_shipped'           => 'shipped',
        'goods_left_after_shipping' => 'active',
        'moved_to_week'             => 'active',
        'other'                     => 'active',
    ];
    $valid = ['active', 'shipped', 'cancelled', 'not_audited', 'failed_audit', 'waiting_for_booking'];

    $rows = $pdo->query('SELECT `id`, `status` FROM `legacy_warehouse_goods`')->fetchAll(PDO::FETCH_ASSOC);
    if (empty($rows)) {
        return;
    }
    $update = $pdo->prepare('UPDATE `legacy_warehouse_goods` SET `status` = ? WHERE `id` = ?');
    foreach ($rows as $row) {
        $s = trim((string) $row['status']);
        $new = $map[$s] ?? (in_array($s, $valid, true) ? $s : 'active');
        if ($new !== $s) {
            $update->execute([$new, $row['id']]);
        }
    }
};

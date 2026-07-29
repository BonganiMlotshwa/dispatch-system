<?php

/**
 * Full order-number normalisation pass.
 *
 * Migration 014 handled the common leading-zero case but used a regex that
 * required at least 5 digits and missed Excel decimal artefacts ("12345.0").
 * This migration applies the same logic as scheduleNormalizeOrderNo() to every
 * row in delivery_schedule_orders and shipments, making it safe to re-run.
 *
 * Tables touched:
 *   - delivery_schedule_orders.order_no
 *   - shipments.customer_order_no
 */
return static function (PDO $pdo): void {

    // Inline the same logic as scheduleNormalizeOrderNo() so the migration
    // is self-contained and not affected by future changes to that function.
    $normalize = static function (string $v): string {
        $v = trim($v);
        if ($v === '') {
            return '';
        }
        $v = (string) preg_replace('/\s+/', '', $v);
        // Excel decimal artefact: "12345.0" or "12345.00" → "12345"
        if (preg_match('/^(\d+)\.0+$/', $v, $m)) {
            $v = $m[1];
        }
        // Strip leading zeros from pure-numeric strings
        if (preg_match('/^\d+$/', $v)) {
            $stripped = ltrim($v, '0');
            return $stripped === '' ? '0' : $stripped;
        }
        return $v;
    };

    // --- delivery_schedule_orders.order_no ---
    $rows = $pdo->query('SELECT id, order_no FROM delivery_schedule_orders')
                ->fetchAll(PDO::FETCH_ASSOC);
    $stmt = $pdo->prepare('UPDATE delivery_schedule_orders SET order_no = ? WHERE id = ?');
    $fixed = 0;
    foreach ($rows as $row) {
        $normalized = $normalize((string) $row['order_no']);
        if ($normalized !== (string) $row['order_no']) {
            $stmt->execute([$normalized, $row['id']]);
            $fixed++;
        }
    }
    echo "delivery_schedule_orders: {$fixed} order_no value(s) normalised.\n";

    // --- shipments.customer_order_no ---
    $colExists = $pdo->query("SHOW COLUMNS FROM shipments LIKE 'customer_order_no'")->fetch();
    if (!$colExists) {
        echo "shipments: customer_order_no column not present — skipped.\n";
        return;
    }

    $rows = $pdo->query(
        "SELECT id, customer_order_no FROM shipments
         WHERE customer_order_no IS NOT NULL AND customer_order_no != ''"
    )->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $pdo->prepare('UPDATE shipments SET customer_order_no = ? WHERE id = ?');
    $fixed = 0;
    foreach ($rows as $row) {
        $normalized = $normalize((string) $row['customer_order_no']);
        if ($normalized !== (string) $row['customer_order_no']) {
            $stmt->execute([$normalized, $row['id']]);
            $fixed++;
        }
    }
    echo "shipments: {$fixed} customer_order_no value(s) normalised.\n";
};

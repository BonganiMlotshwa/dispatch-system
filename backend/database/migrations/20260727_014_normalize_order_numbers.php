<?php

/**
 * Normalize leading zeros in order numbers stored in:
 *   delivery_schedule_orders.order_no
 *   shipments.customer_order_no
 *
 * Excel numeric cells drop leading zeros (stores "12345" not "012345").
 * MRPG XML keeps them. Both sides are now normalized to the stripped form
 * so lookup matches consistently.
 */
return static function (PDO $pdo): void {

    // delivery_schedule_orders
    $pdo->exec("
        UPDATE delivery_schedule_orders
        SET order_no = COALESCE(NULLIF(TRIM(LEADING '0' FROM order_no), ''), order_no)
        WHERE order_no REGEXP '^0[0-9]{4,}$'
    ");
    $scheduleFixed = $pdo->query("SELECT ROW_COUNT()")->fetchColumn();
    echo "delivery_schedule_orders: {$scheduleFixed} order_no values normalized.\n";

    // shipments.customer_order_no
    $colExists = $pdo->query("SHOW COLUMNS FROM shipments LIKE 'customer_order_no'")->fetch();
    if ($colExists) {
        $pdo->exec("
            UPDATE shipments
            SET customer_order_no = COALESCE(NULLIF(TRIM(LEADING '0' FROM customer_order_no), ''), customer_order_no)
            WHERE customer_order_no REGEXP '^0[0-9]{4,}$'
        ");
        $shipmentFixed = $pdo->query("SELECT ROW_COUNT()")->fetchColumn();
        echo "shipments: {$shipmentFixed} customer_order_no values normalized.\n";
    } else {
        echo "shipments: customer_order_no column not found — skipped.\n";
    }
};

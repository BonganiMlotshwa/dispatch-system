<?php
/**
 * Spec 1.5 — warehouse order status.
 * Default Active; scan-in → Active; all cartons scanned out → Shipped.
 * Manual statuses (cancelled, audit, booking) are not overwritten by scanning.
 */
function warehouseOrderStatusOptions() {
    return [
        'active' => 'Active',
        'shipped' => 'Shipped',
        'cancelled' => 'Cancelled',
        'not_audited' => 'Not audited',
        'failed_audit' => 'Failed audit',
        'waiting_for_booking' => 'Waiting for booking',
    ];
}

function normalizeWarehouseOrderStatus($status) {
    $map = [
        'in_warehouse' => 'active',
        'shipped_complete' => 'shipped',
        'partial_shipped' => 'shipped',
        'goods_left_after_shipping' => 'active',
        'moved_to_week' => 'active',
        'other' => 'active',
    ];
    $status = trim((string)$status);
    if (isset($map[$status])) {
        return $map[$status];
    }
    $options = warehouseOrderStatusOptions();
    return isset($options[$status]) ? $status : 'active';
}

/** Set manually on PO — scanning must not override these. */
function isManualWarehouseOrderStatus($status) {
    return in_array(normalizeWarehouseOrderStatus($status), [
        'cancelled',
        'not_audited',
        'failed_audit',
        'waiting_for_booking',
    ], true);
}

/**
 * Derive status from carton scan state.
 * - All cartons exited → Shipped
 * - Any carton entered (or mix in/out) → Active
 * - No cartons / all pending → Active (default)
 */
function deriveWarehouseOrderStatusFromCartons($cartonCount, $enteredCount, $exitedCount, $pendingCount) {
    $total = (int)$cartonCount;
    $exited = (int)$exitedCount;
    $entered = (int)$enteredCount;

    if ($total > 0 && $exited >= $total) {
        return 'shipped';
    }
    if ($entered > 0 || ($exited > 0 && $exited < $total)) {
        return 'active';
    }
    return 'active';
}

function displayWarehouseOrderStatus($storedStatus) {
    return normalizeWarehouseOrderStatus($storedStatus ?: 'active');
}

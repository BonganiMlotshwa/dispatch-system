<?php
require_once __DIR__ . '/warehouse_order_statuses.php';

function legacyWarehouseStatusOptions() {
    return warehouseOrderStatusOptions();
}

function normalizeLegacyWarehouseStatus($status) {
    return normalizeWarehouseOrderStatus($status);
}

function normalizeLegacyPo($po) {
    $po = trim($po);
    if ($po === '') {
        return '';
    }
    if (stripos($po, 'FTM-') === 0) {
        return 'FTM-' . preg_replace('/^FTM-/i', '', $po);
    }
    return 'FTM-' . preg_replace('/[^0-9]/', '', $po);
}

<?php
/**
 * Carton scan statuses (DB: pending, entered, exited).
 * Display "Shipped" when a carton is scanned out (exited).
 */

function normalizeCartonScanStatus($status) {
    $status = strtolower(trim((string)$status));
    if ($status === 'shipped') {
        return 'exited';
    }
    return $status;
}

function cartonStatusLabel($status) {
    switch (normalizeCartonScanStatus($status)) {
        case 'entered':
            return 'In Warehouse';
        case 'exited':
            return 'Shipped';
        case 'pending':
            return 'Pending';
        default:
            return ucfirst($status ?: 'Unknown');
    }
}

function cartonScanSuccessMessage($status) {
    switch (normalizeCartonScanStatus($status)) {
        case 'entered':
            return 'Carton entered warehouse successfully';
        case 'exited':
            return 'Carton shipped successfully';
        case 'pending':
            return 'Carton status updated';
        default:
            return 'Carton updated successfully';
    }
}

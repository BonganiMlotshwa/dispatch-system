<?php
/**
 * PO number helpers — consistent internal PO prefixes and lookup aliases.
 */

function getInternalPoPrefix($customer) {
    $customer = strtoupper(trim((string)$customer));
    if ($customer === 'OTB') {
        return 'OTTO';
    }
    return $customer;
}

function buildInternalPoNumber($customer, $poNumber) {
    return getInternalPoPrefix($customer) . '-' . trim((string)$poNumber);
}

/** Customer-facing PO (e.g. OTTO-809 for OTB). */
function buildCustomerPoNumber($customer, $customerPoNumber) {
    $num = trim((string)$customerPoNumber);
    if ($num === '') {
        return '';
    }
    if (preg_match('/^[A-Z]+-/i', $num)) {
        return $num;
    }
    return getInternalPoPrefix($customer) . '-' . $num;
}

/**
 * Display/export internal PO as FTM-##### (label "FTM PO" in reports).
 * Legacy rows may store OTB-/OTTO- prefixes — normalize for display only.
 */
function formatFtmInternalPo($internalPoNumber) {
    $po = trim((string)$internalPoNumber);
    if ($po === '') {
        return '';
    }
    if (preg_match('/^FTM-/i', $po)) {
        return 'FTM-' . preg_replace('/^FTM-/i', '', $po);
    }
    if (preg_match('/^[A-Z]+-(.+)$/i', $po, $m)) {
        return 'FTM-' . $m[1];
    }
    return 'FTM-' . $po;
}

/** FTM internal order number from manual entry Order No field. */
function normalizeOrderNumber($orderNo) {
    $orderNo = trim((string)$orderNo);
    if ($orderNo === '') {
        return '';
    }
    if (preg_match('/^FTM-/i', $orderNo)) {
        return 'FTM-' . preg_replace('/^FTM-/i', '', $orderNo);
    }
    if (preg_match('/^(?:OTB|OTTO|OBSW|MRP)-(.+)$/i', $orderNo, $m)) {
        return 'FTM-' . $m[1];
    }
    if (preg_match('/^[A-Z]+-(.+)$/i', $orderNo, $m)) {
        return 'FTM-' . $m[1];
    }
    return 'FTM-' . $orderNo;
}

function formatCustomerPoDisplay($customer, $poNumberFromCarton) {
    if ($poNumberFromCarton === null || $poNumberFromCarton === '') {
        return 'N/A';
    }
    $po = trim((string)$poNumberFromCarton);
    if (preg_match('/^[A-Z]+-/i', $po)) {
        return $po;
    }
    return buildCustomerPoNumber($customer, $po);
}

function isOtbCustomer($customer) {
    $c = strtoupper(trim((string)$customer));
    return $c === 'OTB' || $c === 'OTTO';
}

/**
 * Values to match when validating or scanning (handles OTB-/OTTO- alias).
 */
function getPoLookupValues($po) {
    $po = trim((string)$po);
    if ($po === '') {
        return [];
    }

    $values = [$po];

    if (preg_match('/^OTB-(.+)$/i', $po, $m)) {
        $values[] = 'OTTO-' . $m[1];
        $values[] = 'FTM-' . $m[1];
    }
    if (preg_match('/^OTTO-(.+)$/i', $po, $m)) {
        $values[] = 'OTB-' . $m[1];
        $values[] = 'FTM-' . $m[1];
    }
    if (preg_match('/^FTM-(.+)$/i', $po, $m)) {
        $values[] = 'OTB-' . $m[1];
        $values[] = 'OTTO-' . $m[1];
    }

    return array_values(array_unique($values));
}

function cartonMatchesExpectedPo(array $carton, $expectedPo) {
    foreach (getPoLookupValues($expectedPo) as $candidate) {
        if (isset($carton['po_number']) && strcasecmp((string)$carton['po_number'], $candidate) === 0) {
            return true;
        }
        if (isset($carton['internal_po_number'])) {
            if (strcasecmp((string)$carton['internal_po_number'], $candidate) === 0) {
                return true;
            }
            if (strcasecmp(formatFtmInternalPo($carton['internal_po_number']), $candidate) === 0) {
                return true;
            }
        }
    }
    return false;
}

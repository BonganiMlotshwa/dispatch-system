<?php
/**
 * PO number helpers — consistent internal PO prefixes and lookup aliases.
 */

function getInternalPoPrefix($customer) {
    $customer = strtoupper(trim((string)$customer));
    if ($customer === 'OTB') {
        return 'OTTO';
    }
    if ($customer === 'MRP') {
        return 'FTM';
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
    $c = strtoupper(trim((string)$customer));
    if (preg_match('/^[A-Z]+-/i', $po)) {
        if ($c === 'OTB' || $c === 'OTTO') {
            if (preg_match('/^(?:OTB|OTTO)-(.+)$/i', $po, $m)) {
                return 'OTTO-' . $m[1];
            }
        }
        return $po;
    }
    return buildCustomerPoNumber($customer, $po);
}

/** Customer PO without prefix (e.g. 1260836 instead of FTM-1260836). MRP only. */
function formatCustomerPoNumberOnly($poNumber) {
    if ($poNumber === null || $poNumber === '') {
        return 'N/A';
    }
    $po = trim((string)$poNumber);
    if (preg_match('/^[A-Za-z]+-(.+)$/i', $po, $m)) {
        return $m[1];
    }
    return $po;
}

/** MRP: number only. OTB: OTTO-###. Others: full prefixed PO. */
function formatCustomerPoForDisplay($customer, $poNumber) {
    if ($poNumber === null || $poNumber === '') {
        return 'N/A';
    }
    $c = strtoupper(trim((string)$customer));
    if ($c === 'MRP') {
        return formatCustomerPoNumberOnly($poNumber);
    }
    if ($c === 'OTB' || $c === 'OTTO') {
        return formatCustomerPoDisplay('OTB', $poNumber);
    }
    return formatCustomerPoDisplay($customer, $poNumber);
}

/** List/report PO — OTB shows OTTO-, MRP shows FTM-. */
function formatInternalPoDisplay($customer, $internalPoNumber) {
    if ($internalPoNumber === null || $internalPoNumber === '') {
        return 'N/A';
    }
    $c = strtoupper(trim((string)$customer));
    $po = trim((string)$internalPoNumber);
    if (preg_match('/^[A-Za-z]+-(.+)$/i', $po, $m)) {
        $digits = $m[1];
    } else {
        $digits = $po;
    }
    if ($c === 'OTB' || $c === 'OTTO') {
        return 'OTTO-' . preg_replace('/^OTTO-/i', '', $digits);
    }
    if ($c === 'MRP') {
        return formatFtmInternalPo($internalPoNumber);
    }
    if ($c === 'OBSW') {
        return 'OBSW-' . preg_replace('/^OBSW-/i', '', $digits);
    }
    $prefix = getInternalPoPrefix($customer);
    return $prefix . '-' . preg_replace('/^' . preg_quote($prefix, '/') . '-/i', '', $digits);
}

function isOtbCustomer($customer) {
    $c = strtoupper(trim((string)$customer));
    return $c === 'OTB' || $c === 'OTTO';
}

/**
 * Values to match when validating or scanning (handles customer-prefix aliases).
 */
function getPoLookupValues($po) {
    $po = trim((string)$po);
    if ($po === '') {
        return [];
    }

    $values = [$po];

    $normalized = normalizeOrderNumber($po);
    if ($normalized !== '' && strcasecmp($normalized, $po) !== 0) {
        $values[] = $normalized;
    }

    if (preg_match('/^FTM-(.+)$/i', $normalized, $m)) {
        $values[] = 'MRP-' . $m[1];
    }
    if (preg_match('/^MRP-(.+)$/i', $po, $m)) {
        $values[] = 'FTM-' . $m[1];
    }
    if (preg_match('/^FTM-(.+)$/i', $po, $m)) {
        $values[] = 'MRP-' . $m[1];
    }
    if (preg_match('/^OTB-(.+)$/i', $po, $m)) {
        $values[] = 'OTTO-' . $m[1];
        $values[] = 'FTM-' . $m[1];
    }
    if (preg_match('/^OTTO-(.+)$/i', $po, $m)) {
        $values[] = 'OTB-' . $m[1];
        $values[] = 'FTM-' . $m[1];
    }
    if (preg_match('/^OBSW-(.+)$/i', $po, $m)) {
        $values[] = 'FTM-' . $m[1];
    }
    if (preg_match('/^FTM-(.+)$/i', $po, $m)) {
        $values[] = 'MRP-' . $m[1];
        $values[] = 'OTB-' . $m[1];
        $values[] = 'OTTO-' . $m[1];
        $values[] = 'OBSW-' . $m[1];
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

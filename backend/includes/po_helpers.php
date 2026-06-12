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

/** List/report PO — Always show FTM- prefix for internal PO (spec clarification). */
function formatInternalPoDisplay($customer, $internalPoNumber) {
    if ($internalPoNumber === null || $internalPoNumber === '') {
        return 'N/A';
    }
    // Always return FTM- format for internal PO, regardless of customer
    return formatFtmInternalPo($internalPoNumber);
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

/** Numeric part of internal PO for sorting (FTM-15730 → 15730). */
function poNumericSortKey($internalPo) {
    $po = trim((string)$internalPo);
    if ($po === '') {
        return 0;
    }
    if (preg_match('/(\d+)/', $po, $m)) {
        return (int)$m[1];
    }
    return 0;
}

/** Ascending sort: FTM-9 before FTM-10 before FTM-10000. */
function comparePoNumbers($a, $b) {
    $ka = poNumericSortKey($a);
    $kb = poNumericSortKey($b);
    if ($ka !== $kb) {
        return $ka <=> $kb;
    }
    return strcasecmp((string)$a, (string)$b);
}

/** Legacy/export customer label — use typed name when customer is Other. */
function formatLegacyCustomerLabel($customer, $customerOther = null) {
    $c = trim((string)$customer) ?: 'MRP';
    if (strcasecmp($c, 'Other') === 0) {
        $other = trim((string)$customerOther);
        return $other !== '' ? $other : 'Other';
    }
    return $c;
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

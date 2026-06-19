<?php
/**
 * Backfill unlinked shipments when schedules are loaded or updated.
 */

declare(strict_types=1);

require_once __DIR__ . '/schedule_lookup.php';

function shipmentHasScheduleColumns(PDO $pdo): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $cached = (bool) $pdo->query("SHOW COLUMNS FROM shipments LIKE 'schedule_status'")->fetch();
    return $cached;
}

function shipmentIsPendingPo(string $internalPoNumber): bool
{
    return str_starts_with(strtoupper(trim($internalPoNumber)), 'PENDING-');
}

function shipmentPendingOrderFromPo(string $internalPoNumber): ?string
{
    if (!shipmentIsPendingPo($internalPoNumber)) {
        return null;
    }
    return trim(substr($internalPoNumber, 8));
}

function shipmentGetCustomerOrderNo(array $shipment): string
{
    $orderNo = trim((string) ($shipment['customer_order_no'] ?? ''));
    if ($orderNo !== '') {
        return $orderNo;
    }
    return shipmentPendingOrderFromPo((string) ($shipment['internal_po_number'] ?? '')) ?? '';
}

function shipmentGetScannedCount(PDO $pdo, int $shipmentId): int
{
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM cartons WHERE shipment_id = ? AND status IN ('entered', 'exited')"
    );
    $stmt->execute([$shipmentId]);
    return (int) $stmt->fetchColumn();
}

function shipmentIsEligibleForBackfill(array $shipment): bool
{
    $status = (string) ($shipment['schedule_status'] ?? 'manual');
    if ($status === 'unlinked') {
        return true;
    }
    if (shipmentIsPendingPo((string) ($shipment['internal_po_number'] ?? ''))) {
        return true;
    }
    return $status !== 'linked' && shipmentGetCustomerOrderNo($shipment) !== '';
}

function shipmentClassifyBackfillRow(array $shipment, array $match): array
{
    $shipmentId = (int) $shipment['id'];
    $scannedCount = (int) ($shipment['scanned_count'] ?? 0);
    $currentPo = trim((string) ($shipment['internal_po_number'] ?? ''));
    $newPo = $match['internal_po_number'];
    $currentStyle = trim((string) ($shipment['style'] ?? ''));
    $currentColor = trim((string) ($shipment['color'] ?? ''));
    $currentQty = trim((string) ($shipment['order_qty'] ?? ''));

    $indentChanges = $currentPo !== '' && $currentPo !== $newPo && !shipmentIsPendingPo($currentPo);
    $metaChanges = ($currentStyle !== '' && $currentStyle !== $match['style'])
        || ($currentColor !== '' && $currentColor !== $match['color'])
        || ($currentQty !== '' && $currentQty !== $match['quantity']);

    $safeAuto = !$indentChanges && $scannedCount === 0;
    if (shipmentIsPendingPo($currentPo) || (string) ($shipment['schedule_status'] ?? '') === 'unlinked') {
        $safeAuto = $scannedCount === 0;
        $indentChanges = false;
    }

    $level = 'safe';
    if ($scannedCount > 0 && ($indentChanges || $currentPo !== $newPo)) {
        $level = 'conflict';
    } elseif ($indentChanges || $metaChanges || $scannedCount > 0) {
        $level = 'review';
    } elseif ($safeAuto) {
        $level = 'safe';
    }

    return [
        'shipment_id' => $shipmentId,
        'file_name' => $shipment['file_name'] ?? '',
        'customer_order_no' => shipmentGetCustomerOrderNo($shipment),
        'current_internal_po_number' => $currentPo,
        'proposed_internal_po_number' => $newPo,
        'current_style' => $currentStyle,
        'proposed_style' => $match['style'],
        'current_color' => $currentColor,
        'proposed_color' => $match['color'],
        'current_quantity' => $currentQty,
        'proposed_quantity' => $match['quantity'],
        'schedule_week_label' => $match['week_label'],
        'schedule_id' => $match['schedule_id'],
        'scanned_count' => $scannedCount,
        'backfill_level' => $level,
        'safe_auto' => $level === 'safe',
        'message' => match ($level) {
            'safe' => 'Ready to link automatically.',
            'review' => 'Review suggested changes before applying.',
            'conflict' => 'Cartons already scanned — indent change needs careful review.',
            default => '',
        },
    ];
}

function scheduleFindBackfillCandidates(PDO $pdo, ?int $scheduleId = null): array
{
    if (!shipmentHasScheduleColumns($pdo)) {
        return [];
    }

    $sql = "SELECT s.id, s.internal_po_number, s.customer_order_no, s.style, s.color, s.order_qty,
                   s.schedule_status, s.file_name, s.import_date, s.schedule_id,
                   (SELECT COUNT(*) FROM cartons c WHERE c.shipment_id = s.id AND c.status IN ('entered', 'exited')) AS scanned_count
            FROM shipments s
            WHERE s.schedule_status = 'unlinked'
               OR s.internal_po_number LIKE 'PENDING-%'
               OR (s.customer_order_no IS NOT NULL AND s.customer_order_no != '' AND s.schedule_status != 'linked')";
    $stmt = $pdo->query($sql);
    $shipments = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $candidates = [];
    foreach ($shipments as $shipment) {
        if (!shipmentIsEligibleForBackfill($shipment)) {
            continue;
        }

        $orderNo = shipmentGetCustomerOrderNo($shipment);
        if ($orderNo === '') {
            continue;
        }

        $lookup = scheduleLookupOrderInLibrary($pdo, $orderNo, $scheduleId);
        if (empty($lookup['match'])) {
            continue;
        }

        $row = shipmentClassifyBackfillRow($shipment, $lookup['match']);
        $row['ambiguous_schedule'] = !empty($lookup['ambiguous']);
        $row['alternate_weeks'] = array_map(
            static fn(array $alt): string => (string) ($alt['week_label'] ?? ''),
            $lookup['alternates'] ?? []
        );
        $candidates[] = $row;
    }

    return $candidates;
}

function scheduleApplyBackfill(PDO $pdo, array $items): array
{
    if (!shipmentHasScheduleColumns($pdo)) {
        throw new RuntimeException('Schedule link columns are not installed. Run database migrations.');
    }

    $applied = 0;
    $skipped = 0;
    $errors = [];

    $select = $pdo->prepare(
        'SELECT id, internal_po_number, customer_order_no, style, color, order_qty, schedule_status
         FROM shipments WHERE id = ? LIMIT 1'
    );
    $poCheck = $pdo->prepare('SELECT id FROM shipments WHERE internal_po_number = ? AND id != ? LIMIT 1');

    $update = $pdo->prepare(
        'UPDATE shipments
         SET internal_po_number = ?, style = ?, color = ?, order_qty = ?,
             schedule_status = ?, schedule_id = ?, schedule_week_label = ?, customer_order_no = ?
         WHERE id = ?'
    );

    foreach ($items as $item) {
        $shipmentId = (int) ($item['shipment_id'] ?? 0);
        if ($shipmentId <= 0) {
            $skipped++;
            continue;
        }

        $select->execute([$shipmentId]);
        $shipment = $select->fetch(PDO::FETCH_ASSOC);
        if (!$shipment) {
            $errors[] = "Shipment #{$shipmentId} not found.";
            $skipped++;
            continue;
        }

        $orderNo = shipmentGetCustomerOrderNo($shipment);
        $scheduleId = !empty($item['schedule_id']) ? (int) $item['schedule_id'] : null;
        $lookup = scheduleLookupOrderInLibrary($pdo, $orderNo, $scheduleId);
        if (empty($lookup['match'])) {
            $errors[] = "No schedule match for order {$orderNo} (shipment #{$shipmentId}).";
            $skipped++;
            continue;
        }

        $match = $lookup['match'];
        $classification = shipmentClassifyBackfillRow($shipment, $match);
        $applyIndent = !empty($item['apply_indent']) || $classification['safe_auto'];
        $force = !empty($item['force']);

        if ($classification['backfill_level'] === 'conflict' && !$force) {
            $errors[] = "Shipment #{$shipmentId} needs forced confirmation (cartons scanned).";
            $skipped++;
            continue;
        }
        if ($classification['backfill_level'] === 'review' && !$force && empty($item['confirmed'])) {
            $errors[] = "Shipment #{$shipmentId} requires review confirmation.";
            $skipped++;
            continue;
        }

        $newPo = $applyIndent ? $match['internal_po_number'] : (string) $shipment['internal_po_number'];
        if ($newPo !== $shipment['internal_po_number']) {
            $poCheck->execute([$newPo, $shipmentId]);
            if ($poCheck->fetch()) {
                $errors[] = "Cannot update shipment #{$shipmentId}: {$newPo} already exists.";
                $skipped++;
                continue;
            }
        }

        try {
            $update->execute([
                $newPo,
                $match['style'] ?: $shipment['style'],
                $match['color'] ?: $shipment['color'],
                $match['quantity'] ?: $shipment['order_qty'],
                'linked',
                $match['schedule_id'],
                $match['week_label'],
                $orderNo,
                $shipmentId,
            ]);
            $applied++;
        } catch (Throwable $e) {
            $errors[] = "Shipment #{$shipmentId}: " . $e->getMessage();
            $skipped++;
        }
    }

    return [
        'applied' => $applied,
        'skipped' => $skipped,
        'errors' => $errors,
    ];
}

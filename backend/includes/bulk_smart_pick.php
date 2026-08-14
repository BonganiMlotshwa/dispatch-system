<?php
/**
 * Smart pick for bulk .mrpg previews — detect duplicate orders and recommend the best file.
 */

declare(strict_types=1);

require_once __DIR__ . '/schedule_backfill.php';

function bulkPickParseQuantity(?string $quantity): int
{
    if ($quantity === null || $quantity === '') {
        return 0;
    }
    return (int) preg_replace('/\D/', '', $quantity);
}

function bulkPickScore(array $preview): int
{
    if (empty($preview['success'])) {
        return PHP_INT_MIN;
    }

    if (!empty($preview['already_imported'])) {
        return PHP_INT_MIN + 1;
    }

    $cartons = (int) ($preview['carton_count'] ?? 0);
    $scheduleQty = bulkPickParseQuantity($preview['quantity'] ?? null);

    $score = $cartons * 1_000_000;

    if ($scheduleQty > 0 && $cartons > 0) {
        $diff = abs($cartons - $scheduleQty);
        $score += max(0, 50_000 - $diff);
    }

    if (!empty($preview['matched'])) {
        $score += 10_000;
    }

    return $score;
}

function bulkPickCompare(array $left, array $right): int
{
    $leftScore = bulkPickScore($left);
    $rightScore = bulkPickScore($right);

    if ($leftScore !== $rightScore) {
        return $leftScore <=> $rightScore;
    }

    $leftCartons = (int) ($left['carton_count'] ?? 0);
    $rightCartons = (int) ($right['carton_count'] ?? 0);
    if ($leftCartons !== $rightCartons) {
        return $leftCartons <=> $rightCartons;
    }

    return strcmp((string) ($left['file_name'] ?? ''), (string) ($right['file_name'] ?? ''));
}

function bulkPickGroupKey(array $preview, int $index): string
{
    $orderNo = trim((string) ($preview['customer_order_no'] ?? ''));
    if ($orderNo !== '') {
        return 'order:' . $orderNo;
    }

    $indent = trim((string) ($preview['internal_po_number'] ?? ''));
    if ($indent !== '') {
        return 'indent:' . strtoupper($indent);
    }

    return 'file:' . $index;
}

function bulkPickBuildReason(array $winner, array $loser): string
{
    $winnerCartons = (int) ($winner['carton_count'] ?? 0);
    $loserCartons = (int) ($loser['carton_count'] ?? 0);
    $orderNo = $winner['customer_order_no'] ?? 'this order';

    if ($winnerCartons > $loserCartons) {
        return "Skipped: {$winner['file_name']} has more cartons ({$winnerCartons} vs {$loserCartons}) for order {$orderNo}.";
    }

    if ($winnerCartons < $loserCartons) {
        return "Skipped: another file has more cartons ({$winnerCartons} vs {$loserCartons}) for order {$orderNo}.";
    }

    return "Skipped: duplicate file for order {$orderNo}; {$winner['file_name']} was chosen.";
}

function bulkPickWinnerReason(array $winner, int $groupSize): string
{
    $cartons = (int) ($winner['carton_count'] ?? 0);
    $orderNo = $winner['customer_order_no'] ?? '';
    $qty = bulkPickParseQuantity($winner['quantity'] ?? null);

    if ($groupSize <= 1) {
        return '';
    }

    if ($qty > 0) {
        return "Recommended: {$cartons} cartons (schedule qty {$qty}) — best of {$groupSize} files for order {$orderNo}.";
    }

    return "Recommended: {$cartons} cartons — most complete of {$groupSize} files for order {$orderNo}.";
}

function bulkEnrichImportStatus(PDO $pdo, array $previews): array
{
    $poStmt = $pdo->prepare('SELECT id, file_name FROM shipments WHERE internal_po_number = ? LIMIT 1');
    $nameStmt = $pdo->prepare('SELECT id FROM shipments WHERE file_name = ? LIMIT 1');
    $hasScheduleCols = shipmentHasScheduleColumns($pdo);
    $orderStmt = $hasScheduleCols
        ? $pdo->prepare('SELECT id, internal_po_number FROM shipments WHERE customer_order_no = ? LIMIT 1')
        : null;

    foreach ($previews as $index => $preview) {
        if (empty($preview['success'])) {
            continue;
        }

        if (!empty($preview['already_imported'])) {
            continue;
        }

        $internalPo = trim((string) ($preview['internal_po_number'] ?? ''));
        $fileName = trim((string) ($preview['file_name'] ?? ''));
        $orderNo = trim((string) ($preview['customer_order_no'] ?? ''));

        $previews[$index]['already_imported'] = false;
        $previews[$index]['import_block_reason'] = null;

        if ($internalPo !== '') {
            $poStmt->execute([$internalPo]);
            $existing = $poStmt->fetch(PDO::FETCH_ASSOC);
            if ($existing) {
                $previews[$index]['already_imported'] = true;
                $previews[$index]['import_block_reason'] = "FTM PO {$internalPo} is already imported.";
                $previews[$index]['existing_shipment_id'] = (int) $existing['id'];
                continue;
            }
        }

        if ($orderStmt && $orderNo !== '') {
            $orderStmt->execute([$orderNo]);
            $byOrder = $orderStmt->fetch(PDO::FETCH_ASSOC);
            if ($byOrder) {
                $previews[$index]['already_imported'] = true;
                $previews[$index]['import_block_reason'] = 'Order ' . $orderNo . ' already imported as ' . $byOrder['internal_po_number'] . '.';
                $previews[$index]['existing_shipment_id'] = (int) $byOrder['id'];
                continue;
            }
        }

        if ($fileName !== '') {
            $nameStmt->execute([$fileName]);
            if ($nameStmt->fetch()) {
                $previews[$index]['already_imported'] = true;
                $previews[$index]['import_block_reason'] = "File {$fileName} was already imported.";
            }
        }
    }

    return $previews;
}

function bulkApplySmartPick(array $previews): array
{
    $groups = [];

    foreach ($previews as $index => $preview) {
        if (empty($preview['success'])) {
            $previews[$index]['pick_recommended'] = false;
            $previews[$index]['pick_selected'] = false;
            $previews[$index]['pick_reason'] = $preview['message'] ?? 'Invalid file';
            $previews[$index]['duplicate_group'] = null;
            continue;
        }

        $key = bulkPickGroupKey($preview, $index);
        $groups[$key][] = $index;
    }

    $duplicateGroups = [];

    foreach ($groups as $key => $indices) {
        if (count($indices) === 1) {
            $index = $indices[0];
            $preview = $previews[$index];
            $previews[$index]['duplicate_group'] = null;
            $previews[$index]['duplicate_count'] = 1;

            if (!empty($preview['already_imported'])) {
                $previews[$index]['pick_recommended'] = false;
                $previews[$index]['pick_selected'] = false;
                $previews[$index]['pick_reason'] = $preview['import_block_reason'];
            } else {
                $previews[$index]['pick_recommended'] = true;
                $previews[$index]['pick_selected'] = true;
                $previews[$index]['pick_reason'] = null;
            }
            continue;
        }

        $sorted = $indices;
        usort($sorted, static function (int $a, int $b) use ($previews): int {
            return bulkPickCompare($previews[$b], $previews[$a]);
        });

        $winnerIndex = $sorted[0];
        $winner = $previews[$winnerIndex];
        $orderNo = $winner['customer_order_no'] ?? $key;
        $groupFiles = [];

        foreach ($indices as $index) {
            $preview = $previews[$index];
            $previews[$index]['duplicate_group'] = (string) $orderNo;
            $previews[$index]['duplicate_count'] = count($indices);

            $groupFiles[] = [
                'file_name' => $preview['file_name'],
                'carton_count' => (int) ($preview['carton_count'] ?? 0),
                'recommended' => $index === $winnerIndex,
                'already_imported' => !empty($preview['already_imported']),
            ];

            if (!empty($preview['already_imported'])) {
                $previews[$index]['pick_recommended'] = false;
                $previews[$index]['pick_selected'] = false;
                $previews[$index]['pick_reason'] = $preview['import_block_reason'];
                continue;
            }

            if ($index === $winnerIndex) {
                $previews[$index]['pick_recommended'] = true;
                $previews[$index]['pick_selected'] = true;
                $previews[$index]['pick_reason'] = bulkPickWinnerReason($winner, count($indices));
            } else {
                $previews[$index]['pick_recommended'] = false;
                $previews[$index]['pick_selected'] = false;
                $previews[$index]['pick_reason'] = bulkPickBuildReason($winner, $preview);
            }
        }

        $duplicateGroups[] = [
            'order_no' => (string) $orderNo,
            'file_count' => count($indices),
            'recommended_file' => $winner['file_name'],
            'recommended_cartons' => (int) ($winner['carton_count'] ?? 0),
            'schedule_quantity' => $winner['quantity'] ?? null,
            'skipped_count' => count($indices) - 1,
            'files' => $groupFiles,
            'message' => sprintf(
                '%d files for order %s — auto-selected %s (%d cartons)',
                count($indices),
                $orderNo,
                $winner['file_name'],
                (int) ($winner['carton_count'] ?? 0)
            ),
        ];
    }

    return [
        'previews' => $previews,
        'duplicate_groups' => $duplicateGroups,
        'duplicate_group_count' => count($duplicateGroups),
        'auto_skipped_count' => count(array_filter(
            $previews,
            static fn(array $p): bool => !empty($p['success'])
                && !empty($p['duplicate_count'])
                && (int) $p['duplicate_count'] > 1
                && empty($p['pick_selected'])
        )),
        'selected_count' => count(array_filter(
            $previews,
            static fn(array $p): bool => !empty($p['success']) && !empty($p['pick_selected'])
        )),
    ];
}

<?php
/**
 * Delivery schedule persistence and lookup helpers.
 */

declare(strict_types=1);

require_once __DIR__ . '/schedule_parser.php';

function scheduleDeactivateAll(PDO $pdo): void
{
    $pdo->exec('UPDATE delivery_schedules SET is_active = 0');
}

function scheduleActivate(PDO $pdo, int $scheduleId): void
{
    scheduleDeactivateAll($pdo);
    $stmt = $pdo->prepare('UPDATE delivery_schedules SET is_active = 1 WHERE id = ?');
    $stmt->execute([$scheduleId]);
}

function scheduleGetActive(PDO $pdo): ?array
{
    $stmt = $pdo->query(
        'SELECT id, week_label, file_name, order_count, is_active, imported_at
         FROM delivery_schedules
         WHERE is_active = 1
         ORDER BY imported_at DESC
         LIMIT 1'
    );
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function scheduleListAll(PDO $pdo): array
{
    $stmt = $pdo->query(
        'SELECT s.id, s.week_label, s.file_name, s.order_count, s.is_active, s.imported_at,
                COUNT(DISTINCT sh.id) AS linked_shipment_count
         FROM delivery_schedules s
         LEFT JOIN shipments sh ON sh.schedule_id = s.id
         GROUP BY s.id, s.week_label, s.file_name, s.order_count, s.is_active, s.imported_at
         ORDER BY s.imported_at DESC'
    );
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function scheduleDelete(PDO $pdo, int $scheduleId): array
{
    $stmt = $pdo->prepare('SELECT id, week_label, file_name, is_active FROM delivery_schedules WHERE id = ? LIMIT 1');
    $stmt->execute([$scheduleId]);
    $schedule = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$schedule) {
        return ['success' => false, 'message' => 'Schedule not found'];
    }

    $linkedStmt = $pdo->prepare('SELECT COUNT(*) FROM shipments WHERE schedule_id = ?');
    $linkedStmt->execute([$scheduleId]);
    $linkedShipmentCount = (int) $linkedStmt->fetchColumn();

    $pdo->beginTransaction();
    try {
        $unlink = $pdo->prepare(
            "UPDATE shipments
             SET schedule_id = NULL,
                 schedule_week_label = NULL,
                 schedule_status = CASE WHEN schedule_status = 'linked' THEN 'unlinked' ELSE schedule_status END
             WHERE schedule_id = ?"
        );
        $unlink->execute([$scheduleId]);

        $delete = $pdo->prepare('DELETE FROM delivery_schedules WHERE id = ?');
        $delete->execute([$scheduleId]);

        if ((int) $schedule['is_active'] === 1) {
            $next = $pdo->query('SELECT id FROM delivery_schedules ORDER BY imported_at DESC, id DESC LIMIT 1')->fetch(PDO::FETCH_ASSOC);
            if ($next) {
                scheduleActivate($pdo, (int) $next['id']);
            }
        }

        $pdo->commit();

        $scheduleFile = __DIR__ . '/../uploads/schedules/' . basename((string) ($schedule['file_name'] ?? ''));
        if (is_file($scheduleFile)) {
            @unlink($scheduleFile);
        }
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    return [
        'success' => true,
        'message' => 'Schedule deleted',
        'week_label' => (string) $schedule['week_label'],
        'linked_shipment_count' => $linkedShipmentCount,
    ];
}

function scheduleSaveParsed(PDO $pdo, array $parsed, bool $setActive = true): array
{
    $weekLabel = $parsed['week_label'];
    $fileName = $parsed['file_name'];

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT id FROM delivery_schedules WHERE week_label = ? LIMIT 1');
        $stmt->execute([$weekLabel]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $scheduleId = (int) $existing['id'];
            $update = $pdo->prepare(
                'UPDATE delivery_schedules
                 SET file_name = ?, order_count = ?, imported_at = NOW()
                 WHERE id = ?'
            );
            $update->execute([$fileName, $parsed['order_count'], $scheduleId]);

            $delete = $pdo->prepare('DELETE FROM delivery_schedule_orders WHERE schedule_id = ?');
            $delete->execute([$scheduleId]);
        } else {
            $insert = $pdo->prepare(
                'INSERT INTO delivery_schedules (week_label, file_name, order_count, is_active)
                 VALUES (?, ?, ?, 0)'
            );
            $insert->execute([$weekLabel, $fileName, $parsed['order_count']]);
            $scheduleId = (int) $pdo->lastInsertId();
        }

        $orderStmt = $pdo->prepare(
            'INSERT INTO delivery_schedule_orders
             (schedule_id, order_no, indent_no, description, colour, order_qty, sewing_line)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );

        foreach ($parsed['orders'] as $order) {
            $orderStmt->execute([
                $scheduleId,
                scheduleNormalizeOrderNo((string) $order['order_no']),
                $order['indent_no'],
                $order['description'] ?: null,
                $order['colour'] ?: null,
                $order['order_qty'] ?: null,
                $order['sewing_line'] ?: null,
            ]);
        }

        if ($setActive) {
            scheduleActivate($pdo, $scheduleId);
        }

        $pdo->commit();

        return [
            'success' => true,
            'schedule_id' => $scheduleId,
            'week_label' => $weekLabel,
            'order_count' => $parsed['order_count'],
            'is_active' => $setActive,
        ];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function scheduleLookupOrder(PDO $pdo, string $orderNo, ?int $scheduleId = null): ?array
{
    $result = scheduleLookupOrderInLibrary($pdo, $orderNo, $scheduleId);
    return $result['match'];
}

function scheduleLookupOrderInLibrary(PDO $pdo, string $orderNo, ?int $scheduleId = null): array
{
    $orderNo = scheduleNormalizeOrderNo(trim($orderNo));
    if ($orderNo === '') {
        return ['match' => null, 'ambiguous' => false, 'alternates' => []];
    }

    // The leading-zero fallback handles DB rows that were stored before normalisation ran.
    // TRIM(LEADING '0' FROM o.order_no) is only evaluated for rows whose order_no starts
    // with a leading zero, so index usage on the primary equality branch is preserved.
    $leadingZeroRegex = '^0[0-9]+$';

    if ($scheduleId !== null) {
        $stmt = $pdo->prepare(
            'SELECT o.order_no, o.indent_no, o.description, o.colour, o.order_qty, o.sewing_line,
                    s.week_label, s.id AS schedule_id
             FROM delivery_schedule_orders o
             INNER JOIN delivery_schedules s ON s.id = o.schedule_id
             WHERE o.schedule_id = ?
               AND (o.order_no = ?
                    OR (o.order_no REGEXP ?
                        AND TRIM(LEADING \'0\' FROM o.order_no) = ?))
             LIMIT 1'
        );
        $stmt->execute([$scheduleId, $orderNo, $leadingZeroRegex, $orderNo]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return [
            'match' => $row ? scheduleFormatMatch($row) : null,
            'ambiguous' => false,
            'alternates' => [],
        ];
    }

    $stmt = $pdo->prepare(
        'SELECT o.order_no, o.indent_no, o.description, o.colour, o.order_qty, o.sewing_line,
                s.week_label, s.id AS schedule_id, s.imported_at
         FROM delivery_schedule_orders o
         INNER JOIN delivery_schedules s ON s.id = o.schedule_id
         WHERE o.order_no = ?
            OR (o.order_no REGEXP ?
                AND TRIM(LEADING \'0\' FROM o.order_no) = ?)
         ORDER BY s.imported_at DESC, s.id DESC'
    );
    $stmt->execute([$orderNo, $leadingZeroRegex, $orderNo]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    if (empty($rows)) {
        return ['match' => null, 'ambiguous' => false, 'alternates' => []];
    }

    $primary = scheduleFormatMatch($rows[0]);
    $alternates = [];
    foreach (array_slice($rows, 1) as $row) {
        $alternates[] = scheduleFormatMatch($row);
    }

    return [
        'match' => $primary,
        'ambiguous' => count($rows) > 1,
        'alternates' => $alternates,
    ];
}

function scheduleLibraryStats(PDO $pdo): array
{
    $schedules = (int) $pdo->query('SELECT COUNT(*) FROM delivery_schedules')->fetchColumn();
    $orders = (int) $pdo->query('SELECT COUNT(*) FROM delivery_schedule_orders')->fetchColumn();
    $active = scheduleGetActive($pdo);

    return [
        'schedule_count' => $schedules,
        'order_count' => $orders,
        'active' => $active,
    ];
}

function scheduleFormatMatch(array $row): array
{
    $indentNo = trim((string) $row['indent_no']);

    return [
        'matched' => true,
        'order_no' => (string) $row['order_no'],
        'indent_no' => $indentNo,
        'internal_po_number' => 'FTM-' . $indentNo,
        'style' => trim((string) ($row['description'] ?? '')),
        'color' => trim((string) ($row['colour'] ?? '')),
        'quantity' => trim((string) ($row['order_qty'] ?? '')),
        'sewing_line' => trim((string) ($row['sewing_line'] ?? '')),
        'week_label' => (string) ($row['week_label'] ?? ''),
        'schedule_id' => isset($row['schedule_id']) ? (int) $row['schedule_id'] : null,
    ];
}

function scheduleBuildUnmatched(string $orderNo): array
{
    return [
        'matched' => false,
        'order_no' => $orderNo,
        'indent_no' => '',
        'internal_po_number' => '',
        'style' => '',
        'color' => '',
        'quantity' => '',
        'sewing_line' => '',
        'week_label' => '',
        'schedule_id' => null,
    ];
}

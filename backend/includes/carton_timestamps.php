<?php
/**
 * Helpers for carton entry/exit timestamps.
 */

function cartonTimestampColumnsExist(PDO $pdo) {
    static $exists = null;
    if ($exists !== null) {
        return $exists;
    }
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM cartons LIKE " . $pdo->quote('entry_timestamp'));
        $exists = (bool)$stmt->fetch();
    } catch (Exception $e) {
        $exists = false;
    }
    return $exists;
}

/** SQL expression for when a carton entered the warehouse. */
function cartonEntryTimeExpr($alias = 'c') {
    return "COALESCE({$alias}.entry_timestamp, CASE WHEN {$alias}.status IN ('entered','exited') THEN {$alias}.scan_timestamp END)";
}

/** SQL expression for when a carton exited the warehouse. */
function cartonExitTimeExpr($alias = 'c') {
    return "COALESCE({$alias}.exit_timestamp, CASE WHEN {$alias}.status = 'exited' THEN {$alias}.scan_timestamp END)";
}

/**
 * True when a carton was physically received on a given date.
 * Excludes cartons only marked shipped (exit without a prior entry).
 */
function cartonReceivedOnDateSql($alias = 'c') {
    $entry = "{$alias}.entry_timestamp";
    $exit = "{$alias}.exit_timestamp";
    return "({$entry} IS NOT NULL AND DATE({$entry}) = ? AND ({$exit} IS NULL OR {$entry} < {$exit} OR {$alias}.status = 'entered'))";
}

/**
 * Build UPDATE fragments when changing carton status.
 * @return array{sql: string, params: array}
 */
function buildCartonStatusTimestampUpdate($newStatus, $existingStatus, $hasTimestampCols) {
    $now = date('Y-m-d H:i:s');
    $sets = ['status = ?', 'scan_timestamp = ?', 'updated_at = ?'];
    $params = [$newStatus, $now, $now];

    if ($hasTimestampCols) {
        if ($newStatus === 'entered') {
            $sets[] = 'entry_timestamp = COALESCE(entry_timestamp, ?)';
            $params[] = $now;
        } elseif ($newStatus === 'exited') {
            // Do not set entry_timestamp when shipping straight from pending (not received)
            $sets[] = 'exit_timestamp = ?';
            $params[] = $now;
        } elseif ($newStatus === 'pending') {
            $sets[] = 'entry_timestamp = NULL';
            $sets[] = 'exit_timestamp = NULL';
        }
    }

    return ['sql' => implode(', ', $sets), 'params' => $params];
}

<?php
/**
 * Parse weekly delivery schedule Excel (.xlsx) files.
 */

declare(strict_types=1);

function scheduleColumnToIndex(string $column): int
{
    $column = strtoupper($column);
    $index = 0;
    $length = strlen($column);
    for ($i = 0; $i < $length; $i++) {
        $index = $index * 26 + (ord($column[$i]) - ord('A') + 1);
    }
    return $index - 1;
}

function scheduleIndexToColumn(int $index): string
{
    $index++;
    $column = '';
    while ($index > 0) {
        $mod = ($index - 1) % 26;
        $column = chr(ord('A') + $mod) . $column;
        $index = intdiv($index - 1, 26);
    }
    return $column;
}

function scheduleNormalizeHeader(string $value): string
{
    return strtoupper(trim(preg_replace('/\s+/', ' ', $value)));
}

function scheduleReadSharedStrings(ZipArchive $zip): array
{
    $shared = $zip->getFromName('xl/sharedStrings.xml');
    if ($shared === false) {
        return [];
    }

    $xml = simplexml_load_string($shared);
    if ($xml === false) {
        return [];
    }

    $strings = [];
    foreach ($xml->si as $si) {
        if (isset($si->t)) {
            $strings[] = (string) $si->t;
        } elseif (isset($si->r)) {
            $text = '';
            foreach ($si->r as $r) {
                $text .= (string) $r->t;
            }
            $strings[] = $text;
        } else {
            $strings[] = '';
        }
    }

    return $strings;
}

function scheduleReadSheetRows(ZipArchive $zip, array $sharedStrings): array
{
    $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
    if ($sheetXml === false) {
        throw new RuntimeException('Could not read worksheet data from the Excel file.');
    }

    $xml = simplexml_load_string($sheetXml);
    if ($xml === false || !isset($xml->sheetData->row)) {
        throw new RuntimeException('Invalid worksheet structure in the Excel file.');
    }

    $rows = [];
    foreach ($xml->sheetData->row as $row) {
        $rowNumber = (int) $row['r'];
        $cells = [];
        foreach ($row->c as $cell) {
            $ref = (string) $cell['r'];
            if (!preg_match('/^([A-Z]+)(\d+)$/', $ref, $matches)) {
                continue;
            }
            $colIndex = scheduleColumnToIndex($matches[1]);
            $value = isset($cell->v) ? (string) $cell->v : '';
            if (isset($cell['t']) && (string) $cell['t'] === 's') {
                $value = $sharedStrings[(int) $value] ?? $value;
            }
            $cells[$colIndex] = trim($value);
        }
        if (!empty($cells)) {
            ksort($cells);
            $rows[$rowNumber] = $cells;
        }
    }

    return $rows;
}

function scheduleExtractWeekLabel(string $fileName, array $rows): string
{
    if (preg_match('/WEEK\s*0*(\d+)/i', $fileName, $matches)) {
        return 'WEEK ' . str_pad($matches[1], 3, '0', STR_PAD_LEFT);
    }

    foreach (array_slice($rows, 0, 5, true) as $cells) {
        foreach ($cells as $value) {
            if (preg_match('/WEEK\s*0*(\d+)/i', $value, $matches)) {
                return 'WEEK ' . str_pad($matches[1], 3, '0', STR_PAD_LEFT);
            }
        }
    }

    return 'WEEK ' . date('W');
}

function scheduleFindHeaderRow(array $rows): ?array
{
    foreach ($rows as $rowNumber => $cells) {
        $normalized = [];
        foreach ($cells as $index => $value) {
            $normalized[$index] = scheduleNormalizeHeader($value);
        }

        $hasIndent = in_array('INDENT NO', $normalized, true);
        $hasOrder = in_array('ORDER NO', $normalized, true);
        if ($hasIndent && $hasOrder) {
            $columns = [];
            foreach ($normalized as $index => $header) {
                if ($header === 'INDENT NO') {
                    $columns['indent_no'] = $index;
                } elseif ($header === 'ORDER NO') {
                    $columns['order_no'] = $index;
                } elseif ($header === 'DESCRIPTION') {
                    $columns['description'] = $index;
                } elseif ($header === 'COLOUR' || $header === 'COLOR') {
                    $columns['colour'] = $index;
                } elseif ($header === 'SEWING') {
                    $columns['sewing'] = $index;
                } elseif ($header === 'LINE') {
                    $columns['line'] = $index;
                } elseif ($header === 'ORDER') {
                    $columns['order_qty'] = $index;
                } elseif ($header === 'QUANTITY') {
                    $columns['order_qty'] = $index;
                }
            }

            if (!isset($columns['order_no'], $columns['indent_no'])) {
                continue;
            }

            return [
                'row' => $rowNumber,
                'columns' => $columns,
            ];
        }
    }

    return null;
}

function scheduleLooksLikeDataRow(array $cells, array $columns): bool
{
    $orderNo = $cells[$columns['order_no']] ?? '';
    $indentNo = $cells[$columns['indent_no']] ?? '';

    if ($orderNo === '' || $indentNo === '') {
        return false;
    }

    if (!preg_match('/^\d+$/', $orderNo) || !preg_match('/^\d+$/', $indentNo)) {
        return false;
    }

    if (strlen($orderNo) < 5) {
        return false;
    }

    return true;
}

function scheduleParseXlsx(string $filePath): array
{
    if (!file_exists($filePath)) {
        return ['success' => false, 'message' => 'Schedule file not found.'];
    }

    if (!class_exists('ZipArchive')) {
        return ['success' => false, 'message' => 'PHP Zip extension is required to read Excel files.'];
    }

    $zip = new ZipArchive();
    if ($zip->open($filePath) !== true) {
        return ['success' => false, 'message' => 'Could not open the Excel file.'];
    }

    try {
        $sharedStrings = scheduleReadSharedStrings($zip);
        $rows = scheduleReadSheetRows($zip, $sharedStrings);
    } finally {
        $zip->close();
    }

    $header = scheduleFindHeaderRow($rows);
    if ($header === null) {
        return [
            'success' => false,
            'message' => 'Could not find schedule headers (INDENT NO / ORDER NO) in the Excel file.',
        ];
    }

    $columns = $header['columns'];
    $orders = [];
    $seenOrders = [];

    foreach ($rows as $rowNumber => $cells) {
        if ($rowNumber <= $header['row']) {
            continue;
        }

        if (!scheduleLooksLikeDataRow($cells, $columns)) {
            continue;
        }

        $orderNo = $cells[$columns['order_no']];
        if (isset($seenOrders[$orderNo])) {
            continue;
        }

        $sewingLine = '';
        if (isset($columns['sewing'])) {
            $sewingLine = trim($cells[$columns['sewing']] ?? '');
        } elseif (isset($columns['line'])) {
            $sewingLine = trim($cells[$columns['line']] ?? '');
        }

        $orders[] = [
            'order_no' => $orderNo,
            'indent_no' => $cells[$columns['indent_no']],
            'description' => isset($columns['description']) ? trim($cells[$columns['description']] ?? '') : null,
            'colour' => isset($columns['colour']) ? trim($cells[$columns['colour']] ?? '') : null,
            'order_qty' => isset($columns['order_qty']) ? trim((string) ($cells[$columns['order_qty']] ?? '')) : null,
            'sewing_line' => $sewingLine !== '' ? $sewingLine : null,
        ];
        $seenOrders[$orderNo] = true;
    }

    if (empty($orders)) {
        return [
            'success' => false,
            'message' => 'No order rows found in the schedule file.',
        ];
    }

    return [
        'success' => true,
        'week_label' => scheduleExtractWeekLabel(basename($filePath), $rows),
        'file_name' => basename($filePath),
        'orders' => $orders,
        'order_count' => count($orders),
    ];
}

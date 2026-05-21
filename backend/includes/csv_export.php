<?php
/**
 * Consistent CSV output for Excel (UTF-8 BOM + sep= + comma delimiter).
 */

function csvOutputStart($filename) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Pragma: no-cache');
    header('Expires: 0');
    $out = fopen('php://output', 'w');
    fputs($out, "\xEF\xBB\xBF");
    fputs($out, "sep=,\n");
    return $out;
}

function csvWriteRow($out, array $row) {
    fputcsv($out, $row, ',', '"');
}

function csvOutputRows($filename, array $rows) {
    $out = csvOutputStart($filename);
    foreach ($rows as $row) {
        csvWriteRow($out, $row);
    }
    fclose($out);
    exit;
}

function csvOutputEnd($out) {
    fclose($out);
    exit;
}

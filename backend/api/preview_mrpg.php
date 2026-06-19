<?php
/**
 * Preview .mrpg files and match against the active delivery schedule.
 *
 * POST multipart: mrpgFiles[] (one or more .mrpg files)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST method is allowed']);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/xml_parser.php';
require_once __DIR__ . '/../includes/schedule_lookup.php';
require_once __DIR__ . '/../includes/schedule_backfill.php';
require_once __DIR__ . '/../includes/bulk_smart_pick.php';

try {
    $pdo = getDbConnection();
    $activeSchedule = scheduleGetActive($pdo);

    if (!isset($_FILES['mrpgFiles'])) {
        throw new Exception('No files uploaded');
    }

    $files = $_FILES['mrpgFiles'];
    $fileCount = is_array($files['name']) ? count($files['name']) : 0;
    if ($fileCount === 0) {
        throw new Exception('No files uploaded');
    }

    $previews = [];

    for ($i = 0; $i < $fileCount; $i++) {
        $error = is_array($files['error']) ? $files['error'][$i] : $files['error'];
        $name = is_array($files['name']) ? $files['name'][$i] : $files['name'];
        $tmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];

        if ($error !== UPLOAD_ERR_OK) {
            $previews[] = [
                'success' => false,
                'file_name' => $name,
                'message' => 'Upload error for file',
            ];
            continue;
        }

        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if ($extension !== 'mrpg') {
            $previews[] = [
                'success' => false,
                'file_name' => $name,
                'message' => 'Only .mrpg files are allowed',
            ];
            continue;
        }

        $metadata = extractMrpgMetadata($tmpName);
        if (!$metadata['success']) {
            $previews[] = [
                'success' => false,
                'file_name' => $name,
                'message' => $metadata['message'],
            ];
            continue;
        }

        $orderNo = (string) $metadata['customer_order_no'];
        $lookup = scheduleLookupOrderInLibrary($pdo, $orderNo);
        $match = $lookup['match'];
        $matchData = $match ?: scheduleBuildUnmatched($orderNo);

        $alreadyImported = false;
        $importBlockReason = null;
        $existingShipmentId = null;

        if ($matchData['internal_po_number'] !== '') {
            $poStmt = $pdo->prepare('SELECT id FROM shipments WHERE internal_po_number = ? LIMIT 1');
            $poStmt->execute([$matchData['internal_po_number']]);
            $existing = $poStmt->fetch(PDO::FETCH_ASSOC);
            if ($existing) {
                $alreadyImported = true;
                $importBlockReason = 'FTM PO ' . $matchData['internal_po_number'] . ' is already imported.';
                $existingShipmentId = (int) $existing['id'];
            }
        }

        if (!$alreadyImported && shipmentHasScheduleColumns($pdo) && $orderNo !== '') {
            $orderStmt = $pdo->prepare(
                "SELECT id, internal_po_number FROM shipments WHERE customer_order_no = ? AND schedule_status IN ('linked', 'unlinked', 'manual') LIMIT 1"
            );
            $orderStmt->execute([$orderNo]);
            $byOrder = $orderStmt->fetch(PDO::FETCH_ASSOC);
            if ($byOrder) {
                $alreadyImported = true;
                $importBlockReason = 'Order ' . $orderNo . ' is already imported as ' . $byOrder['internal_po_number'] . '.';
                $existingShipmentId = (int) $byOrder['id'];
            }
        }

        $previews[] = [
            'success' => true,
            'file_name' => $name,
            'customer_order_no' => $orderNo,
            'customer_order_numbers' => $metadata['customer_order_numbers'],
            'multiple_orders' => $metadata['multiple_orders'],
            'carton_count' => $metadata['carton_count'],
            'matched' => (bool) $matchData['matched'],
            'ambiguous_schedule' => !empty($lookup['ambiguous']),
            'alternate_weeks' => array_map(
                static fn(array $alt): string => (string) ($alt['week_label'] ?? ''),
                $lookup['alternates'] ?? []
            ),
            'internal_po_number' => $matchData['internal_po_number'],
            'indent_no' => $matchData['indent_no'],
            'style' => $matchData['style'],
            'color' => $matchData['color'],
            'quantity' => $matchData['quantity'],
            'week_label' => $matchData['week_label'],
            'schedule_id' => $matchData['schedule_id'],
            'already_imported' => $alreadyImported,
            'import_block_reason' => $importBlockReason,
            'existing_shipment_id' => $existingShipmentId,
            'can_import_unlinked' => !$alreadyImported && !$matchData['matched'],
        ];
    }

    $previews = bulkEnrichImportStatus($pdo, $previews);
    $pickResult = bulkApplySmartPick($previews);
    $previews = $pickResult['previews'];

    echo json_encode([
        'success' => true,
        'active_schedule' => $activeSchedule,
        'library' => scheduleLibraryStats($pdo),
        'previews' => $previews,
        'duplicate_groups' => $pickResult['duplicate_groups'],
        'duplicate_group_count' => $pickResult['duplicate_group_count'],
        'auto_skipped_count' => $pickResult['auto_skipped_count'],
        'selected_count' => $pickResult['selected_count'],
        'matched_count' => count(array_filter($previews, static fn($p) => !empty($p['success']) && !empty($p['matched']))),
        'unmatched_count' => count(array_filter($previews, static fn($p) => !empty($p['success']) && empty($p['matched']))),
    ]);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}

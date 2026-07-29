<?php
/**
 * Delivery schedule API
 *
 * GET  ?action=list
 * GET  ?action=active
 * GET  ?action=lookup&order_no=1234567
 * POST ?action=upload   (multipart: scheduleFile)
 * POST ?action=activate (JSON: schedule_id)
 * POST ?action=delete   (JSON: schedule_id)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/schedule_lookup.php';
require_once __DIR__ . '/../includes/schedule_backfill.php';

function scheduleJsonResponse(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

try {
    $pdo = getDbConnection();
    $action = $_GET['action'] ?? $_POST['action'] ?? 'list';

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if ($action === 'active') {
            $active = scheduleGetActive($pdo);
            scheduleJsonResponse([
                'success' => true,
                'schedule' => $active,
            ]);
        }

        if ($action === 'list') {
            scheduleJsonResponse([
                'success' => true,
                'schedules' => scheduleListAll($pdo),
                'active' => scheduleGetActive($pdo),
                'library' => scheduleLibraryStats($pdo),
            ]);
        }

        if ($action === 'backfill_preview') {
            $scheduleId = !empty($_GET['schedule_id']) ? (int) $_GET['schedule_id'] : null;
            $candidates = scheduleFindBackfillCandidates($pdo, $scheduleId);
            scheduleJsonResponse([
                'success' => true,
                'candidates' => $candidates,
                'count' => count($candidates),
                'safe_count' => count(array_filter($candidates, static fn(array $c): bool => !empty($c['safe_auto']))),
            ]);
        }

        if ($action === 'lookup') {
            $orderNo = trim($_GET['order_no'] ?? '');
            if ($orderNo === '') {
                scheduleJsonResponse(['success' => false, 'message' => 'order_no is required'], 400);
            }

            $scheduleId = !empty($_GET['schedule_id']) ? (int) $_GET['schedule_id'] : null;
            $lookup = scheduleLookupOrderInLibrary($pdo, $orderNo, $scheduleId);

            scheduleJsonResponse([
                'success' => true,
                'order_no' => $orderNo,
                'match' => $lookup['match'] ?: scheduleBuildUnmatched($orderNo),
                'ambiguous' => $lookup['ambiguous'],
                'alternates' => $lookup['alternates'],
            ]);
        }

        scheduleJsonResponse(['success' => false, 'message' => 'Unknown action'], 400);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        scheduleJsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
    }

    if ($action === 'activate') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $scheduleId = (int) ($input['schedule_id'] ?? $_POST['schedule_id'] ?? 0);
        if ($scheduleId <= 0) {
            scheduleJsonResponse(['success' => false, 'message' => 'schedule_id is required'], 400);
        }

        $check = $pdo->prepare('SELECT id FROM delivery_schedules WHERE id = ?');
        $check->execute([$scheduleId]);
        if (!$check->fetch()) {
            scheduleJsonResponse(['success' => false, 'message' => 'Schedule not found'], 404);
        }

        scheduleActivate($pdo, $scheduleId);
        scheduleJsonResponse([
            'success' => true,
            'message' => 'Schedule activated',
            'schedule_id' => $scheduleId,
        ]);
    }

    if ($action === 'delete') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $scheduleId = (int) ($input['schedule_id'] ?? $_POST['schedule_id'] ?? 0);
        if ($scheduleId <= 0) {
            scheduleJsonResponse(['success' => false, 'message' => 'schedule_id is required'], 400);
        }

        $result = scheduleDelete($pdo, $scheduleId);
        if (!$result['success']) {
            scheduleJsonResponse($result, 404);
        }

        scheduleJsonResponse($result);
    }
    if ($action === 'backfill_apply') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $items = $input['items'] ?? [];
        if (!is_array($items) || empty($items)) {
            scheduleJsonResponse(['success' => false, 'message' => 'items array is required'], 400);
        }

        $result = scheduleApplyBackfill($pdo, $items);
        scheduleJsonResponse([
            'success' => true,
            'message' => "Linked {$result['applied']} shipment(s).",
            'result' => $result,
        ]);
    }

    if ($action === 'upload') {
        if (!isset($_FILES['scheduleFile']) || $_FILES['scheduleFile']['error'] !== UPLOAD_ERR_OK) {
            scheduleJsonResponse(['success' => false, 'message' => 'No schedule file uploaded'], 400);
        }

        $uploaded = $_FILES['scheduleFile'];
        $extension = strtolower(pathinfo($uploaded['name'], PATHINFO_EXTENSION));
        if (!in_array($extension, ['xlsx', 'xls'], true)) {
            scheduleJsonResponse(['success' => false, 'message' => 'Only Excel schedule files (.xlsx) are supported'], 400);
        }

        if ($extension !== 'xlsx') {
            scheduleJsonResponse(['success' => false, 'message' => 'Please upload .xlsx format schedule files'], 400);
        }

        $uploadDir = __DIR__ . '/../uploads/schedules/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $targetPath = $uploadDir . time() . '_' . basename($uploaded['name']);
        if (!move_uploaded_file($uploaded['tmp_name'], $targetPath)) {
            scheduleJsonResponse(['success' => false, 'message' => 'Failed to save uploaded schedule file'], 500);
        }

        $parsed = scheduleParseXlsx($targetPath);
        if (!$parsed['success']) {
            unlink($targetPath);
            scheduleJsonResponse(['success' => false, 'message' => $parsed['message']], 400);
        }

        $setActive = ($_POST['set_active'] ?? '1') !== '0';
        $saved = scheduleSaveParsed($pdo, $parsed, $setActive);
        $backfillCandidates = scheduleFindBackfillCandidates($pdo, $saved['schedule_id']);

        $safeCandidates = array_values(array_filter(
            $backfillCandidates,
            static fn(array $c): bool => !empty($c['safe_auto'])
        ));
        $reviewCandidates = array_values(array_filter(
            $backfillCandidates,
            static fn(array $c): bool => empty($c['safe_auto'])
        ));

        $autoApplied = ['applied' => 0, 'skipped' => 0, 'errors' => []];
        if (!empty($safeCandidates)) {
            $autoApplied = scheduleApplyBackfill($pdo, $safeCandidates);
        }

        scheduleJsonResponse([
            'success' => true,
            'message' => 'Schedule imported successfully',
            'schedule' => [
                'id' => $saved['schedule_id'],
                'week_label' => $saved['week_label'],
                'file_name' => $parsed['file_name'],
                'order_count' => $saved['order_count'],
                'is_active' => $saved['is_active'],
            ],
            'backfill' => [
                'auto_applied' => $autoApplied['applied'],
                'auto_errors' => $autoApplied['errors'],
                'review_needed' => $reviewCandidates,
                'review_count' => count($reviewCandidates),
            ],
        ]);
    }

    scheduleJsonResponse(['success' => false, 'message' => 'Unknown action'], 400);
} catch (Throwable $e) {
    scheduleJsonResponse([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage(),
    ], 500);
}

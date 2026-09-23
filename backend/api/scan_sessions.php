<?php
/**
 * Scan Sessions API
 * GET  ?date=YYYY-MM-DD           — list sessions for a date
 * GET  ?id=123                    — one session with all entries
 * POST { po_number, barcode, carton_seq, action, success, error_message, operator_name }
 *       — upsert session for (today, po_number), append entry, update counts
 */

header('Content-Type: application/json');

require_once '../includes/cors.php';
cors_headers(['GET', 'POST']);
require_once '../includes/auth.php';
auth_require_user();
require_once '../config/database.php';

$pdo    = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : null;

        if ($id) {
            $stmt = $pdo->prepare('SELECT * FROM scan_sessions WHERE id = ?');
            $stmt->execute([$id]);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$session) {
                echo json_encode(['success' => false, 'message' => 'Session not found']);
                exit;
            }
            $stmt = $pdo->prepare(
                'SELECT * FROM scan_session_entries WHERE session_id = ? ORDER BY scanned_at ASC'
            );
            $stmt->execute([$id]);
            $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'session' => $session, 'entries' => $entries]);
        } else {
            $date = $_GET['date'] ?? date('Y-m-d');
            $po   = $_GET['po']   ?? null;
            $sql    = 'SELECT * FROM scan_sessions WHERE session_date = ?';
            $params = [$date];
            if ($po) {
                $sql    .= ' AND po_number = ?';
                $params[] = $po;
            }
            $sql .= ' ORDER BY po_number ASC, started_at ASC';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            echo json_encode(['success' => true, 'sessions' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        }

    } elseif ($method === 'POST') {
        $body         = json_decode(file_get_contents('php://input'), true) ?? [];
        $po           = trim($body['po_number']    ?? '');
        $barcode      = trim($body['barcode']      ?? '');
        $cartonSeq    = isset($body['carton_seq']) && $body['carton_seq'] !== null
                            ? (int)$body['carton_seq'] : null;
        $action       = $body['action']       ?? 'enter';
        $success      = !empty($body['success']) ? 1 : 0;
        $errorMsg     = $body['error_message'] ?? null;
        $operatorName = $body['operator_name'] ?? 'Unknown';
        $now          = date('Y-m-d H:i:s');
        $today        = date('Y-m-d');

        if (!$po || !$barcode) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'po_number and barcode are required']);
            exit;
        }

        // Upsert session (one per day per PO)
        $pdo->prepare(
            'INSERT INTO scan_sessions
                 (session_date, po_number, operator_name, started_at, last_activity_at,
                  total_scanned, total_success, total_failed)
             VALUES (?, ?, ?, ?, ?, 0, 0, 0)
             ON DUPLICATE KEY UPDATE
                 last_activity_at = VALUES(last_activity_at),
                 operator_name    = VALUES(operator_name)'
        )->execute([$today, $po, $operatorName, $now, $now]);

        // Fetch session id
        $stmt = $pdo->prepare(
            'SELECT id FROM scan_sessions WHERE session_date = ? AND po_number = ?'
        );
        $stmt->execute([$today, $po]);
        $sessionId = (int)$stmt->fetchColumn();

        // Insert entry
        $pdo->prepare(
            'INSERT INTO scan_session_entries
                 (session_id, barcode, carton_seq, action, success, error_message, scanned_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        )->execute([$sessionId, $barcode, $cartonSeq, $action, $success, $errorMsg, $now]);

        // Update session counters
        $pdo->prepare(
            'UPDATE scan_sessions
             SET total_scanned      = total_scanned + 1,
                 total_success      = total_success + ?,
                 total_failed       = total_failed  + ?,
                 last_activity_at   = ?
             WHERE id = ?'
        )->execute([$success, 1 - $success, $now, $sessionId]);

        echo json_encode(['success' => true, 'session_id' => $sessionId]);

    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

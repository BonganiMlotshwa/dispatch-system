<?php
/**
 * Receive Cartons API - marks all pending cartons for a shipment as 'entered'
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'POST only']);
    exit;
}

require_once '../config/database.php';

try {
    $data = json_decode(file_get_contents('php://input'), true);
    $shipmentId = isset($data['shipment_id']) ? (int)$data['shipment_id'] : 0;
    $cartonsToReceive = isset($data['cartons_to_receive']) ? (int)$data['cartons_to_receive'] : 0;

    if (!$shipmentId) throw new Exception('Invalid shipment ID');
    if ($cartonsToReceive < 1) throw new Exception('cartons_to_receive must be at least 1');

    $pdo = getDbConnection();

    // Get pending carton IDs limited to the requested count
    $stmt = $pdo->prepare(
        "SELECT id FROM cartons WHERE shipment_id = ? AND status = 'pending' ORDER BY id ASC LIMIT ?"
    );
    $stmt->execute([$shipmentId, $cartonsToReceive]);
    $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (empty($ids)) throw new Exception('No pending cartons found for this shipment');

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $now = date('Y-m-d H:i:s');
    $params = array_merge([$now, $now, $now], $ids);
    $pdo->prepare(
        "UPDATE cartons SET status = 'entered', scan_timestamp = ?, entry_timestamp = COALESCE(entry_timestamp, ?), updated_at = ? WHERE id IN ($placeholders)"
    )->execute($params);

    // Return updated counts
    $stmt = $pdo->prepare(
        "SELECT
            COUNT(*) as total,
            SUM(status = 'pending') as pending,
            SUM(status = 'entered') as entered,
            SUM(status = 'exited') as exited
         FROM cartons WHERE shipment_id = ?"
    );
    $stmt->execute([$shipmentId]);
    $counts = $stmt->fetch();

    echo json_encode([
        'success' => true,
        'message' => count($ids) . ' carton(s) marked as received',
        'received' => count($ids),
        'counts' => $counts
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

<?php
/**
 * Admin Delete API with Password Protection
 * Requires special admin code to delete data
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';
require_once '../includes/admin_auth.php';

try {
    $pdo = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (!isset($input['admin_code']) || !isset($input['delete_type']) || !isset($input['id'])) {
        throw new Exception('Admin code, delete type, and ID are required');
    }
    
    // Verify admin code
    if (!verifyAdminCode($input['admin_code'] ?? '')) {
        throw new Exception('Invalid admin code. Access denied.');
    }
    
    $deleteType = $input['delete_type'];
    $id = (int)$input['id'];
    
    $pdo->beginTransaction();
    
    switch ($deleteType) {
        case 'shipment':
            // Delete shipment (cascades to cartons)
            $fileStmt = $pdo->prepare("SELECT file_name FROM shipments WHERE id = ? LIMIT 1");
            $fileStmt->execute([$id]);
            $shipmentFile = $fileStmt->fetchColumn();

            $stmt = $pdo->prepare("DELETE FROM shipments WHERE id = ?");
            $stmt->execute([$id]);

            if ($shipmentFile) {
                $uploadPath = __DIR__ . '/../uploads/' . basename((string)$shipmentFile);
                if (is_file($uploadPath)) {
                    @unlink($uploadPath);
                }
            }

            $message = 'Shipment deleted successfully';
            break;
            
        case 'carton':
            // Delete single carton
            $stmt = $pdo->prepare("DELETE FROM cartons WHERE id = ?");
            $stmt->execute([$id]);
            $message = 'Carton deleted successfully';
            break;
            
        case 'truck_shipment':
            // Delete truck shipment
            $stmt = $pdo->prepare("DELETE FROM truck_shipments WHERE id = ?");
            $stmt->execute([$id]);
            $message = 'Truck shipment deleted successfully';
            break;

        case 'legacy_warehouse_goods':
            $stmt = $pdo->prepare('DELETE FROM legacy_warehouse_goods WHERE id = ?');
            $stmt->execute([$id]);
            $message = 'Legacy warehouse entry deleted successfully';
            break;
            
        case 'user':
            // Delete user (prevent deleting admin)
            $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
            $stmt->execute([$id]);
            $user = $stmt->fetch();
            
            if ($user && $user['role'] === 'admin') {
                throw new Exception('Cannot delete admin user');
            }
            
            $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
            $stmt->execute([$id]);
            $message = 'User deleted successfully';
            break;
            
        default:
            throw new Exception('Invalid delete type');
    }
    
    $pdo->commit();
    
    // Log the deletion
    error_log("ADMIN DELETE: Type=$deleteType, ID=$id, Time=" . date('Y-m-d H:i:s'));
    
    echo json_encode([
        'success' => true,
        'message' => $message
    ]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

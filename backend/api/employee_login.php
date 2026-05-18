<?php
/**
 * Employee Login API
 * Uses employee codes instead of username/password
 * Displays only employee name in "Scanned by" column
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';

try {
    $pdo = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['employee_code'])) {
        throw new Exception('Employee code is required');
    }
    
    $employeeCode = trim($input['employee_code']);
    
    // Find employee by code
    $stmt = $pdo->prepare("
        SELECT id, employee_code, employee_name, role, is_active 
        FROM employees 
        WHERE employee_code = ?
    ");
    $stmt->execute([$employeeCode]);
    $employee = $stmt->fetch();
    
    if (!$employee) {
        throw new Exception('Invalid employee code');
    }
    
    if (!$employee['is_active']) {
        throw new Exception('Employee account is inactive');
    }
    
    // Update last login
    $stmt = $pdo->prepare("UPDATE employees SET last_login = NOW() WHERE id = ?");
    $stmt->execute([$employee['id']]);
    
    // Create session token
    $token = bin2hex(random_bytes(32));
    $stmt = $pdo->prepare("
        INSERT INTO employee_sessions (employee_id, token, expires_at) 
        VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 8 HOUR))
    ");
    $stmt->execute([$employee['id'], $token]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'employee' => [
            'id' => $employee['id'],
            'name' => $employee['employee_name'],
            'role' => $employee['role'],
            'token' => $token
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

<?php
/**
 * User Management API
 * Admin-only endpoints for creating, updating, and managing users
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/../config/database.php';

session_start();

// Helper function to check if user is authenticated and is admin
function requireAdmin(PDO $pdo): array {
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['username'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Not authenticated']);
        exit;
    }
    
    $stmt = $pdo->prepare('SELECT id, username, role FROM users WHERE id = ? AND is_active = 1');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user || $user['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Admin access required']);
        exit;
    }
    
    return $user;
}

// Helper function to log audit actions
function logAudit(PDO $pdo, array $currentUser, string $actionType, ?int $targetUserId, ?string $targetUsername, $oldValue, $newValue, string $description): void {
    $stmt = $pdo->prepare(
        'INSERT INTO user_audit_log 
        (action_by_user_id, action_by_username, action_type, target_user_id, target_username, old_value, new_value, description, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    
    $stmt->execute([
        $currentUser['id'],
        $currentUser['username'],
        $actionType,
        $targetUserId,
        $targetUsername,
        $oldValue ? json_encode($oldValue) : null,
        $newValue ? json_encode($newValue) : null,
        $description,
        $_SERVER['REMOTE_ADDR'] ?? null
    ]);
}

try {
    $pdo = getDbConnection();
    $currentUser = requireAdmin($pdo);
    
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? 'list';
    
    // GET: List users or get audit log
    if ($method === 'GET') {
        if ($action === 'list') {
            $stmt = $pdo->query(
                'SELECT id, username, full_name, email, role, is_active, last_login, 
                        failed_login_attempts, locked_until, created_at, updated_at
                 FROM users
                 ORDER BY created_at DESC'
            );
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'users' => $users,
                'current_user_id' => $currentUser['id']
            ]);
        }
        elseif ($action === 'audit_log') {
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
            $stmt = $pdo->prepare(
                'SELECT * FROM user_audit_log 
                 ORDER BY created_at DESC 
                 LIMIT ?'
            );
            $stmt->execute([$limit]);
            $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'audit_log' => $logs
            ]);
        }
        else {
            throw new Exception('Invalid action');
        }
    }
    
    // POST: Create new user
    elseif ($method === 'POST' && $action === 'create') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $username = trim($data['username'] ?? '');
        $password = $data['password'] ?? '';
        $fullName = trim($data['full_name'] ?? '');
        $email = trim($data['email'] ?? '');
        $role = $data['role'] ?? 'user';
        $isActive = isset($data['is_active']) ? (int)$data['is_active'] : 1;
        
        // Validation
        if (empty($username)) {
            throw new Exception('Username is required');
        }
        if (strlen($username) < 3) {
            throw new Exception('Username must be at least 3 characters');
        }
        if (empty($password)) {
            throw new Exception('Password is required');
        }
        if (strlen($password) < 6) {
            throw new Exception('Password must be at least 6 characters');
        }
        if (!in_array($role, ['admin', 'user', 'viewer'])) {
            throw new Exception('Invalid role');
        }
        
        // Check if username already exists
        $checkStmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
        $checkStmt->execute([$username]);
        if ($checkStmt->fetch()) {
            throw new Exception('Username already exists');
        }
        
        // Hash password
        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
        
        // Insert user
        $stmt = $pdo->prepare(
            'INSERT INTO users (username, password, full_name, email, role, is_active)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$username, $hashedPassword, $fullName, $email, $role, $isActive]);
        $newUserId = (int)$pdo->lastInsertId();
        
        // Log audit
        logAudit(
            $pdo,
            $currentUser,
            'create',
            $newUserId,
            $username,
            null,
            ['username' => $username, 'role' => $role, 'is_active' => $isActive],
            "Created user '{$username}' with role '{$role}'"
        );
        
        echo json_encode([
            'success' => true,
            'message' => "User '{$username}' created successfully",
            'user_id' => $newUserId
        ]);
    }
    
    // PUT: Update user
    elseif ($method === 'PUT' && $action === 'update') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $userId = (int)($data['user_id'] ?? 0);
        if ($userId <= 0) {
            throw new Exception('Invalid user ID');
        }
        
        // Get current user data
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $targetUser = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$targetUser) {
            throw new Exception('User not found');
        }
        
        // Build update fields
        $updates = [];
        $params = [];
        $oldValues = [];
        $newValues = [];
        
        if (isset($data['full_name'])) {
            $updates[] = 'full_name = ?';
            $params[] = trim($data['full_name']);
            $oldValues['full_name'] = $targetUser['full_name'];
            $newValues['full_name'] = trim($data['full_name']);
        }
        
        if (isset($data['email'])) {
            $updates[] = 'email = ?';
            $params[] = trim($data['email']);
            $oldValues['email'] = $targetUser['email'];
            $newValues['email'] = trim($data['email']);
        }
        
        if (isset($data['role'])) {
            if (!in_array($data['role'], ['admin', 'user', 'viewer'])) {
                throw new Exception('Invalid role');
            }
            // Prevent self-demotion from admin
            if ($userId === $currentUser['id'] && $data['role'] !== 'admin' && $targetUser['role'] === 'admin') {
                throw new Exception('You cannot remove your own admin privileges');
            }
            $updates[] = 'role = ?';
            $params[] = $data['role'];
            $oldValues['role'] = $targetUser['role'];
            $newValues['role'] = $data['role'];
        }
        
        if (isset($data['is_active'])) {
            // Prevent self-deactivation
            if ($userId === $currentUser['id'] && !$data['is_active']) {
                throw new Exception('You cannot deactivate your own account');
            }
            $updates[] = 'is_active = ?';
            $params[] = (int)$data['is_active'];
            $oldValues['is_active'] = $targetUser['is_active'];
            $newValues['is_active'] = (int)$data['is_active'];
        }
        
        if (empty($updates)) {
            throw new Exception('No fields to update');
        }
        
        $params[] = $userId;
        $sql = 'UPDATE users SET ' . implode(', ', $updates) . ', updated_at = NOW() WHERE id = ?';
        $pdo->prepare($sql)->execute($params);
        
        // Log audit
        $actionType = isset($data['role']) && $data['role'] !== $targetUser['role'] ? 'role_change' : 'update';
        logAudit(
            $pdo,
            $currentUser,
            $actionType,
            $userId,
            $targetUser['username'],
            $oldValues,
            $newValues,
            "Updated user '{$targetUser['username']}'"
        );
        
        echo json_encode([
            'success' => true,
            'message' => "User '{$targetUser['username']}' updated successfully"
        ]);
    }
    
    // PUT: Reset password
    elseif ($method === 'PUT' && $action === 'reset_password') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $userId = (int)($data['user_id'] ?? 0);
        $newPassword = $data['new_password'] ?? '';
        
        if ($userId <= 0) {
            throw new Exception('Invalid user ID');
        }
        if (strlen($newPassword) < 6) {
            throw new Exception('Password must be at least 6 characters');
        }
        
        $stmt = $pdo->prepare('SELECT username FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $targetUser = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$targetUser) {
            throw new Exception('User not found');
        }
        
        $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?');
        $stmt->execute([$hashedPassword, $userId]);
        
        // Log audit
        logAudit(
            $pdo,
            $currentUser,
            'password_reset',
            $userId,
            $targetUser['username'],
            null,
            null,
            "Reset password for user '{$targetUser['username']}'"
        );
        
        echo json_encode([
            'success' => true,
            'message' => "Password reset successfully for '{$targetUser['username']}'"
        ]);
    }
    
    // DELETE: Delete user (soft delete by deactivating)
    elseif ($method === 'DELETE' && $action === 'delete') {
        $userId = (int)($_GET['user_id'] ?? 0);
        
        if ($userId <= 0) {
            throw new Exception('Invalid user ID');
        }
        if ($userId === $currentUser['id']) {
            throw new Exception('You cannot delete your own account');
        }
        
        $stmt = $pdo->prepare('SELECT username, role FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $targetUser = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$targetUser) {
            throw new Exception('User not found');
        }
        
        // Actually delete the user (or you can soft delete by setting is_active = 0)
        $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        
        // Log audit
        logAudit(
            $pdo,
            $currentUser,
            'delete',
            $userId,
            $targetUser['username'],
            ['username' => $targetUser['username'], 'role' => $targetUser['role']],
            null,
            "Deleted user '{$targetUser['username']}'"
        );
        
        echo json_encode([
            'success' => true,
            'message' => "User '{$targetUser['username']}' deleted successfully"
        ]);
    }
    
    else {
        throw new Exception('Invalid request method or action');
    }
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

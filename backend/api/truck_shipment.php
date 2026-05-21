<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';

try {
    $pdo = getDbConnection();
    
    // GET: Retrieve truck shipments
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        
        // Get specific truck shipment
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare("
                SELECT ts.*, 
                    COUNT(tsi.id) as total_orders,
                    SUM(tsi.cartons_shipped) as total_cartons,
                    SUM(tsi.units_shipped) as total_units
                FROM truck_shipments ts
                LEFT JOIN truck_shipment_items tsi ON ts.id = tsi.truck_shipment_id
                WHERE ts.id = ?
                GROUP BY ts.id
            ");
            $stmt->execute([$_GET['id']]);
            $shipment = $stmt->fetch();
            
            if (!$shipment) {
                throw new Exception('Truck shipment not found');
            }
            
            // Get items
            $stmt = $pdo->prepare("
                SELECT tsi.*, s.internal_po_number, s.customer, s.style, s.color
                FROM truck_shipment_items tsi
                INNER JOIN shipments s ON tsi.shipment_id = s.id
                WHERE tsi.truck_shipment_id = ?
                ORDER BY tsi.id
            ");
            $stmt->execute([$_GET['id']]);
            $items = $stmt->fetchAll();
            
            echo json_encode([
                'success' => true,
                'shipment' => $shipment,
                'items' => $items
            ]);
        }
        // List all truck shipments
        else {
            $stmt = $pdo->query("
                SELECT ts.*, 
                    COUNT(tsi.id) as total_orders,
                    SUM(tsi.cartons_shipped) as total_cartons,
                    SUM(tsi.units_shipped) as total_units
                FROM truck_shipments ts
                LEFT JOIN truck_shipment_items tsi ON ts.id = tsi.truck_shipment_id
                GROUP BY ts.id
                ORDER BY ts.shipment_date DESC, ts.created_at DESC
            ");
            $shipments = $stmt->fetchAll();
            
            echo json_encode([
                'success' => true,
                'shipments' => $shipments
            ]);
        }
    }
    
    // POST: Create new truck shipment
    elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Validate required fields
        if (!isset($input['shipment_date']) || !isset($input['truck_reg']) || !isset($input['items'])) {
            throw new Exception('Missing required fields');
        }
        
        $pdo->beginTransaction();
        
        // Create truck shipment
        $stmt = $pdo->prepare("
            INSERT INTO truck_shipments 
            (shipment_date, shipment_week, truck_reg, driver_name, remarks) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $input['shipment_date'],
            $input['shipment_week'] ?? null,
            $input['truck_reg'],
            $input['driver_name'] ?? null,
            $input['remarks'] ?? null
        ]);
        
        $truckShipmentId = $pdo->lastInsertId();
        
        // Add items
        $stmt = $pdo->prepare("
            INSERT INTO truck_shipment_items 
            (truck_shipment_id, shipment_id, cartons_shipped, units_shipped) 
            VALUES (?, ?, ?, ?)
        ");
        
        foreach ($input['items'] as $item) {
            $stmt->execute([
                $truckShipmentId,
                $item['shipment_id'],
                $item['cartons_shipped'],
                $item['units_shipped']
            ]);
        }
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Truck shipment created successfully',
            'truck_shipment_id' => $truckShipmentId
        ]);
    }
    
    // PUT: Update truck shipment
    elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['id'])) {
            throw new Exception('Truck shipment ID is required');
        }
        
        $pdo->beginTransaction();
        
        // Update truck shipment
        $stmt = $pdo->prepare("
            UPDATE truck_shipments 
            SET shipment_date = ?, shipment_week = ?, truck_reg = ?, 
                driver_name = ?, remarks = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $input['shipment_date'],
            $input['shipment_week'] ?? null,
            $input['truck_reg'],
            $input['driver_name'] ?? null,
            $input['remarks'] ?? null,
            $input['id']
        ]);
        
        // Replace items only when explicitly provided
        if (isset($input['items']) && is_array($input['items'])) {
            $stmt = $pdo->prepare("DELETE FROM truck_shipment_items WHERE truck_shipment_id = ?");
            $stmt->execute([$input['id']]);

            $stmt = $pdo->prepare("
                INSERT INTO truck_shipment_items 
                (truck_shipment_id, shipment_id, cartons_shipped, units_shipped) 
                VALUES (?, ?, ?, ?)
            ");
            
            foreach ($input['items'] as $item) {
                $stmt->execute([
                    $input['id'],
                    $item['shipment_id'],
                    $item['cartons_shipped'],
                    $item['units_shipped']
                ]);
            }
        }
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Truck shipment updated successfully'
        ]);
    }
    
    // DELETE: Delete truck shipment
    elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['id'])) {
            throw new Exception('Truck shipment ID is required');
        }
        
        $stmt = $pdo->prepare("DELETE FROM truck_shipments WHERE id = ?");
        $stmt->execute([$input['id']]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Truck shipment deleted successfully'
        ]);
    }
    
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

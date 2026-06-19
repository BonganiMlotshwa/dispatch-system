<?php
/**
 * XML Parser Utility
 * 
 * This file contains functions for parsing XML .mrpg files containing carton label data.
 */

/**
 * Extract summary metadata from an .mrpg file without full import.
 *
 * @param string $filePath Path to the XML file
 * @return array
 */
function extractMrpgMetadata($filePath) {
    if (!file_exists($filePath)) {
        return [
            'success' => false,
            'message' => 'File not found: ' . $filePath,
        ];
    }

    try {
        $xml = simplexml_load_file($filePath);
        if ($xml === false) {
            return [
                'success' => false,
                'message' => 'Failed to parse XML file',
            ];
        }

        if (!isset($xml->Panda)) {
            return [
                'success' => false,
                'message' => 'Invalid XML structure: Missing <Panda> elements',
            ];
        }

        $orderNumbers = [];
        $cartonCount = 0;

        foreach ($xml->Panda as $panda) {
            if (empty($panda->BarCode2D)) {
                continue;
            }

            $cartonCount++;
            $poNumber = trim((string) $panda->PoNumber);
            if ($poNumber !== '') {
                $orderNumbers[$poNumber] = true;
            }
        }

        if ($cartonCount === 0) {
            return [
                'success' => false,
                'message' => 'No valid carton records found in the XML file',
            ];
        }

        $uniqueOrders = array_keys($orderNumbers);
        $primaryOrderNo = count($uniqueOrders) === 1
            ? $uniqueOrders[0]
            : ($uniqueOrders[0] ?? '');

        return [
            'success' => true,
            'file_name' => basename($filePath),
            'customer_order_no' => $primaryOrderNo,
            'customer_order_numbers' => $uniqueOrders,
            'carton_count' => $cartonCount,
            'multiple_orders' => count($uniqueOrders) > 1,
        ];
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Error reading XML: ' . $e->getMessage(),
        ];
    }
}

/**
 * Parse XML file and extract carton data
 * 
 * @param string $filePath Path to the XML file
 * @param string $internalPoNumber User-defined internal PO number
 * @return array Array containing shipment data and carton records
 */
function parseXmlFile($filePath, $internalPoNumber) {
    // Validate file exists
    if (!file_exists($filePath)) {
        return [
            'success' => false,
            'message' => 'File not found: ' . $filePath
        ];
    }
    
    // Get file name for database record
    $fileName = basename($filePath);
    
    try {
        // Load XML file
        $xml = simplexml_load_file($filePath);
        
        if ($xml === false) {
            return [
                'success' => false,
                'message' => 'Failed to parse XML file'
            ];
        }
        
        // Check if XML has the expected structure
        if (!isset($xml->Panda)) {
            return [
                'success' => false,
                'message' => 'Invalid XML structure: Missing <Panda> elements'
            ];
        }
        
        // Prepare shipment data
        $shipmentData = [
            'internal_po_number' => $internalPoNumber,
            'file_name' => $fileName,
            'import_date' => date('Y-m-d H:i:s')
        ];
        
        // Extract carton data from each <Panda> element
        $cartons = [];
        foreach ($xml->Panda as $panda) {
            // Validate required fields
            if (empty($panda->BarCode2D)) {
                continue; // Skip records without barcode
            }
            
            // Extract last four characters of transfer number if available
            $transferNumber = (string)$panda->TransferNumber;
            $transferNumberEndFour = '';
            if (strlen($transferNumber) >= 4) {
                $transferNumberEndFour = substr($transferNumber, -4);
            }
            
            $carton = [
                'po_number' => (string)$panda->PoNumber,
                'pre_pack_id' => (string)$panda->PrePackId,
                'barcode_2d' => (string)$panda->BarCode2D,
                'size' => (string)$panda->Size,
                'units' => (int)$panda->Units,
                'item' => (string)$panda->Item,
                'transfer_number' => $transferNumber,
                'transfer_number_end_four' => $transferNumberEndFour,
                'sequence_number' => (string)$panda->SequenceNumber,
                'heading' => (string)($panda->Heading ?? ''),
                'division' => (string)($panda->Division ?? ''),
                'reserve_or_xdock' => (string)($panda->ReserveOrXdock ?? ''),
                'total_sequence_number' => (string)($panda->TotalSequenceNumber ?? ''),
                'wave_category' => (string)($panda->WaveCategory ?? ''),
                'print_date' => (string)($panda->PrintDate ?? ''),
                'depot_store_code' => (string)($panda->DepotStoreCode ?? ''),
                'status' => 'pending',
                'qc_number' => null,
                'finishing_number' => null,
                'notes' => null
            ];
            
            $cartons[] = $carton;
        }
        
        if (empty($cartons)) {
            return [
                'success' => false,
                'message' => 'No valid carton records found in the XML file'
            ];
        }
        
        return [
            'success' => true,
            'shipment' => $shipmentData,
            'cartons' => $cartons,
            'count' => count($cartons)
        ];
        
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Error parsing XML: ' . $e->getMessage()
        ];
    }
}

function getPrimaryCustomerOrderNo(array $cartons): string
{
    $orders = [];
    foreach ($cartons as $carton) {
        $po = trim((string) ($carton['po_number'] ?? ''));
        if ($po !== '') {
            $orders[$po] = true;
        }
    }
    $keys = array_keys($orders);
    return $keys[0] ?? '';
}

function shipmentHasColumn(PDO $pdo, string $column): bool
{
    static $cache = [];
    if (!array_key_exists($column, $cache)) {
        $stmt = $pdo->query('SHOW COLUMNS FROM shipments LIKE ' . $pdo->quote($column));
        $cache[$column] = (bool) $stmt->fetch();
    }
    return $cache[$column];
}

/**
 * Save imported data to database
 * 
 * @param array $importData Data returned from parseXmlFile()
 * @param PDO $pdo Database connection
 * @return array Result of the import operation
 */
function saveImportedData($importData, $pdo) {
    if (!$importData['success']) {
        return $importData; // Return the error from parsing
    }
    
    try {
        // Begin transaction
        $pdo->beginTransaction();
        
        // Check if this internal PO number already exists
        $stmt = $pdo->prepare("SELECT id FROM shipments WHERE internal_po_number = ?");
        $stmt->execute([$importData['shipment']['internal_po_number']]);
        
        if ($stmt->rowCount() > 0) {
            $pdo->rollBack();
            return [
                'success' => false,
                'message' => 'This FTM PO number already exists in the database. Each FTM PO number must be unique.'
            ];
        }
        
        // Check if this file has already been imported
        $stmt = $pdo->prepare("SELECT id FROM shipments WHERE file_name = ?");
        $stmt->execute([$importData['shipment']['file_name']]);
        
        if ($stmt->rowCount() > 0) {
            $pdo->rollBack();
            return [
                'success' => false,
                'message' => 'This file has already been imported'
            ];
        }

        $customerOrderNo = trim((string) ($importData['customer_order_no'] ?? ''));
        if ($customerOrderNo === '') {
            $customerOrderNo = getPrimaryCustomerOrderNo($importData['cartons']);
        }

        $scheduleStatus = $importData['schedule_status'] ?? 'manual';
        if ($scheduleStatus === 'linked' && shipmentHasColumn($pdo, 'schedule_status')) {
            // ok
        } elseif (($importData['import_mode'] ?? '') === 'unlinked') {
            $scheduleStatus = 'unlinked';
        }

        if ($scheduleStatus === 'unlinked' && $customerOrderNo !== '' && shipmentHasColumn($pdo, 'customer_order_no')) {
            $dupOrder = $pdo->prepare(
                "SELECT id FROM shipments WHERE customer_order_no = ? AND schedule_status = 'unlinked' LIMIT 1"
            );
            $dupOrder->execute([$customerOrderNo]);
            if ($dupOrder->fetch()) {
                $pdo->rollBack();
                return [
                    'success' => false,
                    'message' => "Order {$customerOrderNo} is already imported as unlinked. Link it when the schedule is available.",
                ];
            }
        }
        
        $columns = [
            'internal_po_number' => $importData['shipment']['internal_po_number'],
            'customer' => $importData['customer'] ?? 'MRP',
            'file_name' => $importData['shipment']['file_name'],
            'import_date' => $importData['shipment']['import_date'],
            'style' => $importData['style'] ?? null,
            'color' => $importData['color'] ?? null,
            'order_qty' => $importData['quantity'] ?? null,
            'entry_type' => 'xml',
        ];

        if (shipmentHasColumn($pdo, 'warehouse_order_status')) {
            $columns['warehouse_order_status'] = 'active';
        }
        if (shipmentHasColumn($pdo, 'customer_order_no')) {
            $columns['customer_order_no'] = $customerOrderNo ?: null;
        }
        if (shipmentHasColumn($pdo, 'schedule_status')) {
            $columns['schedule_status'] = $scheduleStatus;
        }
        if (shipmentHasColumn($pdo, 'schedule_id') && !empty($importData['schedule_id'])) {
            $columns['schedule_id'] = (int) $importData['schedule_id'];
        }
        if (shipmentHasColumn($pdo, 'schedule_week_label') && !empty($importData['schedule_week_label'])) {
            $columns['schedule_week_label'] = $importData['schedule_week_label'];
        }

        $fieldNames = array_keys($columns);
        $placeholders = implode(', ', array_fill(0, count($fieldNames), '?'));
        $sql = 'INSERT INTO shipments (' . implode(', ', $fieldNames) . ') VALUES (' . $placeholders . ')';
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array_values($columns));
        
        $shipmentId = $pdo->lastInsertId();
        
        // Insert carton records
        $stmt = $pdo->prepare("INSERT INTO cartons 
            (shipment_id, po_number, pre_pack_id, barcode_2d, size, units, item, 
             transfer_number, transfer_number_end_four, sequence_number, heading, division, 
             reserve_or_xdock, total_sequence_number, wave_category, print_date, depot_store_code, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        foreach ($importData['cartons'] as $carton) {
            $stmt->execute([
                $shipmentId,
                $carton['po_number'],
                $carton['pre_pack_id'],
                $carton['barcode_2d'],
                $carton['size'],
                $carton['units'],
                $carton['item'],
                $carton['transfer_number'],
                $carton['transfer_number_end_four'],
                $carton['sequence_number'],
                $carton['heading'],
                $carton['division'],
                $carton['reserve_or_xdock'],
                $carton['total_sequence_number'],
                $carton['wave_category'],
                $carton['print_date'],
                $carton['depot_store_code'],
                $carton['status']
            ]);
        }
        
        // Commit transaction
        $pdo->commit();
        
        return [
            'success' => true,
            'message' => 'Import completed successfully',
            'shipment_id' => $shipmentId,
            'cartons_imported' => count($importData['cartons']),
            'schedule_status' => $scheduleStatus,
            'internal_po_number' => $importData['shipment']['internal_po_number'],
        ];
        
    } catch (PDOException $e) {
        // Rollback transaction on error
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        
        // Handle specific database errors with user-friendly messages
        $errorMessage = 'Database error occurred';
        
        if (strpos($e->getMessage(), 'Duplicate entry') !== false && strpos($e->getMessage(), 'barcode_2d') !== false) {
            // Extract barcode from error message
            preg_match("/Duplicate entry '([^']+)'/", $e->getMessage(), $matches);
            $duplicateBarcode = isset($matches[1]) ? $matches[1] : 'unknown';
            $errorMessage = "This file contains a barcode ({$duplicateBarcode}) that already exists in the database. Each barcode must be unique.";
        } elseif (strpos($e->getMessage(), 'Duplicate entry') !== false) {
            $errorMessage = 'This file contains duplicate data that already exists in the database.';
        } elseif (strpos($e->getMessage(), 'foreign key constraint') !== false) {
            $errorMessage = 'Data integrity error: Referenced data does not exist.';
        } elseif (strpos($e->getMessage(), 'Data too long') !== false) {
            $errorMessage = 'Some data in the file is too long for the database fields.';
        }
        
        return [
            'success' => false,
            'message' => $errorMessage
        ];
    }
}
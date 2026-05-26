<?php

return static function (PDO $pdo): void {
    require __DIR__ . '/../../migrate_shipment_warehouse_status.php';
};

<?php

return static function (PDO $pdo): void {
    require __DIR__ . '/../../migrate_legacy_warehouse_goods.php';
};

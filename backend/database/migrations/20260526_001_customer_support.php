<?php

return static function (PDO $pdo): void {
    require __DIR__ . '/../../migrate_customer_support.php';
};

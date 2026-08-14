<?php

return static function (PDO $pdo): void {
    $exists = (bool)$pdo->query("SHOW COLUMNS FROM legacy_warehouse_goods LIKE 'customer_other'")->fetch();
    if (!$exists) {
        $pdo->exec("
            ALTER TABLE legacy_warehouse_goods
            ADD COLUMN customer_other varchar(100) DEFAULT NULL
            COMMENT 'Custom customer name when customer = Other'
            AFTER customer
        ");
    }
};

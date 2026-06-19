<?php

return static function (PDO $pdo): void {
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS delivery_schedules (
            id INT AUTO_INCREMENT PRIMARY KEY,
            week_label VARCHAR(50) NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            order_count INT NOT NULL DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 0,
            imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_delivery_schedules_week_label (week_label)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS delivery_schedule_orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            schedule_id INT NOT NULL,
            order_no VARCHAR(50) NOT NULL,
            indent_no VARCHAR(50) NOT NULL,
            description VARCHAR(255) DEFAULT NULL,
            colour VARCHAR(255) DEFAULT NULL,
            order_qty VARCHAR(50) DEFAULT NULL,
            sewing_line VARCHAR(20) DEFAULT NULL,
            FOREIGN KEY (schedule_id) REFERENCES delivery_schedules(id) ON DELETE CASCADE,
            UNIQUE KEY uq_schedule_order (schedule_id, order_no),
            KEY idx_schedule_orders_order_no (order_no)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    echo "delivery_schedules tables ready.\n";
};

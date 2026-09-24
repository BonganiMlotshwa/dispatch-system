<?php
return static function (PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `app_settings` (
            `key` varchar(64) NOT NULL,
            `value` varchar(255) NOT NULL DEFAULT '',
            `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
            PRIMARY KEY (`key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    ");

    $pdo->exec("
        INSERT IGNORE INTO `app_settings` (`key`, `value`) VALUES
            ('show_label_generator', '0'),
            ('show_xml_generator', '0'),
            ('support_email', '')
    ");
};

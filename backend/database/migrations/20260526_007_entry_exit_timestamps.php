<?php

return static function (PDO $pdo): void {
    require __DIR__ . '/../../migrate_entry_exit_timestamps.php';
};

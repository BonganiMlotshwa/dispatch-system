<?php
/**
 * Migration: Drop orphaned password_hash column from users table.
 *
 * Background: the users table was originally created with a `password` column.
 * A later migration added `password_hash` but auth/login.php always read from
 * `password`, so `password_hash` was never used for authentication.
 * create_admin_user.php has been fixed to write to `password` only.
 * This migration removes the dead column to avoid confusion.
 */

return static function (PDO $pdo): void {
    $cols = $pdo->query("SHOW COLUMNS FROM users LIKE 'password_hash'")->fetchAll();
    if (!empty($cols)) {
        $pdo->exec("ALTER TABLE users DROP COLUMN password_hash");
    }
};

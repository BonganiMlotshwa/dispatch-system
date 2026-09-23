<?php
/**
 * Migration: Scan session tracking tables
 * scan_sessions — one record per day per PO
 * scan_session_entries — every individual scan attempt
 */

return static function (PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS scan_sessions (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            session_date    DATE         NOT NULL,
            po_number       VARCHAR(100) NOT NULL,
            operator_name   VARCHAR(100),
            started_at      DATETIME     NOT NULL,
            last_activity_at DATETIME    NOT NULL,
            total_scanned   INT NOT NULL DEFAULT 0,
            total_success   INT NOT NULL DEFAULT 0,
            total_failed    INT NOT NULL DEFAULT 0,
            UNIQUE KEY uq_date_po (session_date, po_number),
            INDEX idx_date  (session_date),
            INDEX idx_po    (po_number)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS scan_session_entries (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            session_id    INT          NOT NULL,
            barcode       VARCHAR(200) NOT NULL,
            carton_seq    INT,
            action        VARCHAR(10)  NOT NULL,
            success       TINYINT(1)  NOT NULL DEFAULT 0,
            error_message VARCHAR(500),
            scanned_at    DATETIME     NOT NULL,
            INDEX idx_session (session_id),
            CONSTRAINT fk_sse_session
                FOREIGN KEY (session_id) REFERENCES scan_sessions(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
};

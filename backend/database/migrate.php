<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

function ensureMigrationsTable(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            migration VARCHAR(255) NOT NULL,
            batch INT NOT NULL DEFAULT 1,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_schema_migrations_migration (migration)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function getAppliedMigrations(PDO $pdo): array
{
    $stmt = $pdo->query('SELECT migration FROM schema_migrations ORDER BY id ASC');
    return $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
}

function getMigrationFiles(): array
{
    $files = glob(__DIR__ . '/migrations/*.php') ?: [];
    natcasesort($files);
    return array_values($files);
}

function runDatabaseMigrations(?PDO $pdo = null): array
{
    if ($pdo === null) {
        $pdo = getDbConnection();
    }

    $backendRoot = dirname(__DIR__);
    if (getcwd() !== $backendRoot) {
        @chdir($backendRoot);
    }

    ensureMigrationsTable($pdo);

    $appliedMigrations = getAppliedMigrations($pdo);
    $appliedLookup = array_flip($appliedMigrations);
    $pendingFiles = [];

    foreach (getMigrationFiles() as $file) {
        $name = basename($file);
        if (!isset($appliedLookup[$name])) {
            $pendingFiles[] = $file;
        }
    }

    if (empty($pendingFiles)) {
        echo "No pending migrations.\n";
        return [
            'applied' => 0,
            'failed' => 0,
            'pending' => 0,
        ];
    }

    $batchStmt = $pdo->query('SELECT COALESCE(MAX(batch), 0) + 1 AS next_batch FROM schema_migrations');
    $batch = (int) ($batchStmt->fetchColumn() ?: 1);

    $applied = 0;
    $failed = 0;

    echo "========================================\n";
    echo "Tracked Migration Runner\n";
    echo "========================================\n\n";

    foreach ($pendingFiles as $file) {
        $name = basename($file);
        echo "Running: {$name}\n";
        echo str_repeat('-', 50) . "\n";

        try {
            $migration = include $file;
            if (!is_callable($migration)) {
                throw new RuntimeException("Migration file did not return a callable: {$name}");
            }

            $migration($pdo);

            $insert = $pdo->prepare(
                'INSERT INTO schema_migrations (migration, batch, applied_at) VALUES (?, ?, NOW())'
            );
            $insert->execute([$name, $batch]);

            echo "Recorded migration: {$name}\n\n";
            $applied++;
        } catch (Throwable $e) {
            echo "ERROR: " . $e->getMessage() . "\n\n";
            $failed++;
            break;
        }
    }

    echo "========================================\n";
    echo "Migration Summary\n";
    echo "========================================\n";
    echo "Applied: {$applied}\n";
    echo "Failed: {$failed}\n";
    echo "Already applied: " . count($appliedMigrations) . "\n";
    echo "========================================\n";

    return [
        'applied' => $applied,
        'failed' => $failed,
        'pending' => count($pendingFiles),
    ];
}

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === basename(__FILE__)) {
    runDatabaseMigrations();
}

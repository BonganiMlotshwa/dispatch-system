<?php
/**
 * Database Configuration File
 * 
 * This file contains the database connection parameters for the
 * Warehouse Carton Tracking System.
 */

// Database connection parameters
define('DB_HOST', 'localhost');
define('DB_NAME', 'warehouse_tracking');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// Connection pool to reuse connections
class DatabasePool {
    private static $instance = null;
    private $connection = null;
    private $lastActivity = null;
    private $maxIdleTime = 300; // 5 minutes
    
    private function __construct() {}
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        // Check if connection exists and is still valid
        if ($this->connection === null || 
            (time() - $this->lastActivity) > $this->maxIdleTime ||
            !$this->isConnectionAlive()) {
            $this->createConnection();
        }
        
        $this->lastActivity = time();
        return $this->connection;
    }
    
    private function createConnection() {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_PERSISTENT => true, // Use persistent connections
                PDO::ATTR_TIMEOUT => 10, // Connection timeout
            ];

            if (PHP_VERSION_ID >= 80500) {
                $options[\Pdo\Mysql::ATTR_INIT_COMMAND] = 'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci';
                $options[\Pdo\Mysql::ATTR_USE_BUFFERED_QUERY] = true;
            } else {
                $options[PDO::MYSQL_ATTR_INIT_COMMAND] = 'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci';
                $options[PDO::MYSQL_ATTR_USE_BUFFERED_QUERY] = true;
            }

            $this->connection = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            error_log("Database Connection Error: " . $e->getMessage());
            throw new Exception("Database connection failed. Please contact system administrator.");
        }
    }
    
    private function isConnectionAlive() {
        try {
            if ($this->connection === null) return false;
            $this->connection->query('SELECT 1');
            return true;
        } catch (PDOException $e) {
            return false;
        }
    }
}

/**
 * Get PDO Database Connection with connection pooling
 * 
 * @return PDO Database connection object
 * @throws Exception If connection fails
 */
function getDbConnection() {
    return DatabasePool::getInstance()->getConnection();
}
// End of database configuration file
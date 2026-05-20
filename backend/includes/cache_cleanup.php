<?php
/**
 * Cache Cleanup Utility
 * 
 * This script cleans up old cache files to prevent disk space issues
 */

function cleanupCache($cacheDir = '../cache', $maxAge = 3600) {
    if (!is_dir($cacheDir)) {
        return;
    }
    
    $files = glob($cacheDir . '/*.json');
    $now = time();
    $cleaned = 0;
    
    foreach ($files as $file) {
        if (is_file($file) && ($now - filemtime($file)) > $maxAge) {
            unlink($file);
            $cleaned++;
        }
    }
    
    return $cleaned;
}

// Auto-cleanup if called directly
if (basename(__FILE__) === basename($_SERVER['SCRIPT_NAME'])) {
    $cleaned = cleanupCache();
    echo "Cleaned up {$cleaned} cache files.\n";
}
?>
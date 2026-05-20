<?php
/**
 * Simple PHP Development Server Starter
 * 
 * This script starts a PHP development server on port 8001
 * to serve the backend API.
 */

$host = '0.0.0.0'; // Listen on all network interfaces
$port = 8001;
$root = __DIR__;

echo "Starting PHP development server at http://{$host}:{$port}/\n";
echo "Document root: {$root}\n";
echo "Press Ctrl+C to stop the server\n\n";

// Start the server
system("php -S {$host}:{$port} -t {$root}");
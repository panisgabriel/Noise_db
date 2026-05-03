<?php
// ============================================================
//  NoiseSense – Database configuration
//  Edit credentials before deployment.
// ============================================================

define('DB_HOST', 'localhost');
define('DB_PORT', 3306);
define('DB_NAME', 'noisesense');
define('DB_USER', 'noisesense_user');     // ← change
define('DB_PASS', 'your_password_here'); // ← change
define('DB_CHARSET', 'utf8mb4');

define('SESSION_LIFETIME', 60 * 60 * 8); // 8 hours in seconds
define('SESSION_COOKIE',   'ns_token');

/**
 * Returns a PDO connection (singleton per request).
 */
function db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        DB_HOST, DB_PORT, DB_NAME, DB_CHARSET
    );
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

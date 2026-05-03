<?php
// ============================================================
//  POST /api/logout.php
//  Destroys the current session token.
// ============================================================
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_helpers.php';

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') abort('Method not allowed', 405);

$user  = require_auth();
$token = $_COOKIE[SESSION_COOKIE] ?? $_SERVER['HTTP_X_NS_TOKEN'] ?? '';

db()->prepare('DELETE FROM sessions WHERE token = ?')->execute([$token]);

// Expire the cookie
setcookie(SESSION_COOKIE, '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
]);

log_action($user['id'], $user['name'], 'Logged out');
json_out(['ok' => true]);

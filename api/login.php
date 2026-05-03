<?php
// ============================================================
//  POST /api/login.php
//  Body: { "email": "...", "password": "..." }
//  Returns: { ok, user: {id, name, email, role}, token }
// ============================================================
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_helpers.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');   // restrict in production
header('Access-Control-Allow-Headers: Content-Type, X-NS-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit; // preflight
if ($_SERVER['REQUEST_METHOD'] !== 'POST')   abort('Method not allowed', 405);

// ── Parse body ──────────────────────────────────────────────
$body     = json_decode(file_get_contents('php://input'), true) ?? [];
$email    = trim($body['email']    ?? '');
$password =       $body['password'] ?? '';

if (!$email || !$password) abort('Email and password are required');

// ── Look up user ─────────────────────────────────────────────
$pdo  = db();
$stmt = $pdo->prepare(
    'SELECT id, name, email, password_hash, role, is_active
     FROM users WHERE email = ? LIMIT 1'
);
$stmt->execute([$email]);
$user = $stmt->fetch();

// Constant-time check even when user not found (prevent timing attacks)
$hash  = $user['password_hash'] ?? '$2y$12$invalidhashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
$valid = password_verify($password, $hash);

if (!$user || !$valid) {
    // Log failed attempt (no user_id since we don't know who)
    log_action(null, 'Unknown', "Failed login attempt for email: {$email}");
    abort('Invalid credentials', 401);
}

if (!$user['is_active']) {
    abort('Account is disabled', 403);
}

// ── Create session ───────────────────────────────────────────
$token     = bin2hex(random_bytes(32));   // 64-char hex token
$expiresAt = date('Y-m-d H:i:s', time() + SESSION_LIFETIME);
$ip        = client_ip();
$ua        = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 400);

$pdo->prepare(
    'INSERT INTO sessions (token, user_id, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?)'
)->execute([$token, $user['id'], $ip, $ua, $expiresAt]);

// ── Set cookie (HTTP-only) ───────────────────────────────────
setcookie(SESSION_COOKIE, $token, [
    'expires'  => time() + SESSION_LIFETIME,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    // 'secure' => true,  // enable when using HTTPS
]);

// ── Log success ───────────────────────────────────────────────
log_action($user['id'], $user['name'], 'Logged in');

// ── Return safe user object ───────────────────────────────────
json_out([
    'ok'    => true,
    'token' => $token,
    'user'  => [
        'id'    => (int) $user['id'],
        'name'  => $user['name'],
        'email' => $user['email'],
        'role'  => $user['role'],
    ],
]);

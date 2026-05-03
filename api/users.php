<?php
// ============================================================
//  /api/users.php
//  GET    – list all users          (admin only)
//  POST   – create user             (admin only)
//  PUT    – update role / profile   (admin for role; self for profile)
//  DELETE – delete user             (admin only, cannot delete self)
// ============================================================
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_helpers.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-NS-Token');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

$me     = require_auth();
$method = $_SERVER['REQUEST_METHOD'];
$pdo    = db();
$body   = json_decode(file_get_contents('php://input'), true) ?? [];

// ── GET – list ────────────────────────────────────────────────
if ($method === 'GET') {
    require_role($me, 'admin');
    $rows = $pdo->query(
        'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY id'
    )->fetchAll();
    json_out(['ok' => true, 'users' => $rows]);
}

// ── POST – create ─────────────────────────────────────────────
if ($method === 'POST') {
    require_role($me, 'admin');

    $name  = trim($body['name']  ?? '');
    $email = trim($body['email'] ?? '');
    $pass  = $body['password']   ?? '';
    $role  = $body['role']       ?? 'user';

    if (!$name || !$email || !$pass) abort('name, email and password required');
    if (!in_array($role, ['user','manager','admin'], true)) abort('Invalid role');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) abort('Invalid email');
    if (strlen($pass) < 6) abort('Password must be at least 6 characters');

    // Check duplicate
    $dup = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $dup->execute([$email]);
    if ($dup->fetch()) abort('Email already exists');

    $hash = password_hash($pass, PASSWORD_BCRYPT);
    $pdo->prepare(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    )->execute([$name, $email, $hash, $role]);

    $newId = (int) $pdo->lastInsertId();
    log_action($me['id'], $me['name'], "Added user: {$name}");
    json_out(['ok' => true, 'id' => $newId], 201);
}

// ── PUT – update ──────────────────────────────────────────────
if ($method === 'PUT') {
    $targetId = (int) ($body['id'] ?? 0);
    if (!$targetId) abort('Missing user id');

    // Only admin can change roles; users can only update their own profile
    $isAdmin  = $me['role'] === 'admin';
    $isSelf   = $me['id']   == $targetId;
    if (!$isAdmin && !$isSelf) abort('Forbidden', 403);

    $fields = [];
    $params = [];

    if (isset($body['name'])) {
        $fields[] = 'name = ?';
        $params[] = trim($body['name']);
    }
    if (isset($body['email'])) {
        if (!filter_var($body['email'], FILTER_VALIDATE_EMAIL)) abort('Invalid email');
        $fields[] = 'email = ?';
        $params[] = trim($body['email']);
    }
    if (isset($body['role']) && $isAdmin) {
        if (!in_array($body['role'], ['user','manager','admin'], true)) abort('Invalid role');
        $fields[] = 'role = ?';
        $params[] = $body['role'];
    }
    if (isset($body['password'])) {
        if (strlen($body['password']) < 6) abort('Password must be at least 6 characters');
        // If changing own password, require current password
        if ($isSelf) {
            $row = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
            $row->execute([$targetId]);
            $u = $row->fetch();
            if (!$u || !password_verify($body['current_password'] ?? '', $u['password_hash'])) {
                abort('Current password is incorrect');
            }
        }
        $fields[] = 'password_hash = ?';
        $params[] = password_hash($body['password'], PASSWORD_BCRYPT);
    }

    if (!$fields) abort('Nothing to update');

    $params[] = $targetId;
    $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')
        ->execute($params);

    log_action($me['id'], $me['name'], "Updated user #{$targetId}");
    json_out(['ok' => true]);
}

// ── DELETE ────────────────────────────────────────────────────
if ($method === 'DELETE') {
    require_role($me, 'admin');
    $targetId = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if (!$targetId) abort('Missing user id');
    if ($targetId === (int) $me['id']) abort('Cannot delete yourself');

    $row = $pdo->prepare('SELECT name FROM users WHERE id = ?');
    $row->execute([$targetId]);
    $u = $row->fetch();
    if (!$u) abort('User not found', 404);

    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$targetId]);
    log_action($me['id'], $me['name'], "Deleted user: {$u['name']}");
    json_out(['ok' => true]);
}

abort('Method not allowed', 405);

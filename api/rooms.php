<?php
// ============================================================
//  /api/rooms.php   – Room CRUD + latest dB reading
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

// ── GET – list rooms with latest reading ──────────────────────
if ($method === 'GET') {
    $rows = $pdo->query(
       'SELECT r.id, r.name, r.lat, r.lng, r.is_active,
               COALESCE(n.db_level, 0)    AS db,
               COALESCE(n.status, "Normal") AS status
        FROM rooms r
        LEFT JOIN noise_readings n
          ON n.id = (
            SELECT id FROM noise_readings
            WHERE room_id = r.id
            ORDER BY recorded_at DESC LIMIT 1
          )
        WHERE r.is_active = 1
        ORDER BY r.id'
    )->fetchAll();
    json_out(['ok' => true, 'rooms' => $rows]);
}

// ── POST – add room (admin only) ──────────────────────────────
if ($method === 'POST') {
    require_role($me, 'admin');
    $name = trim($body['name'] ?? '');
    $lat  = (float) ($body['lat'] ?? 0);
    $lng  = (float) ($body['lng'] ?? 0);
    if (!$name) abort('name required');

    $pdo->prepare(
        'INSERT INTO rooms (name, lat, lng, created_by) VALUES (?, ?, ?, ?)'
    )->execute([$name, $lat, $lng, $me['id']]);

    $newId = (int) $pdo->lastInsertId();
    log_action($me['id'], $me['name'], "Added room: {$name}");
    json_out(['ok' => true, 'id' => $newId], 201);
}

// ── DELETE – soft-delete (admin only) ─────────────────────────
if ($method === 'DELETE') {
    require_role($me, 'admin');
    $id = (int) ($body['id'] ?? $_GET['id'] ?? 0);
    if (!$id) abort('Missing room id');

    $row = $pdo->prepare('SELECT name FROM rooms WHERE id = ?');
    $row->execute([$id]);
    $r = $row->fetch();
    if (!$r) abort('Room not found', 404);

    $pdo->prepare('UPDATE rooms SET is_active = 0 WHERE id = ?')->execute([$id]);
    log_action($me['id'], $me['name'], "Deleted room: {$r['name']}");
    json_out(['ok' => true]);
}

abort('Method not allowed', 405);

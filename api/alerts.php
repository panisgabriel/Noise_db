<?php
// ============================================================
//  /api/alerts.php
//  GET  – list alerts
//  PUT  – resolve an alert (admin or manager)
// ============================================================
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_helpers.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-NS-Token');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

$me     = require_auth();
$method = $_SERVER['REQUEST_METHOD'];
$pdo    = db();

if ($method === 'GET') {
    $rows = $pdo->query(
       'SELECT a.id, r.name AS room, a.db_level AS db, a.severity,
               a.is_resolved AS resolved, a.created_at AS time,
               u.name AS resolved_by_name, a.resolved_at
        FROM alerts a
        JOIN rooms r ON r.id = a.room_id
        LEFT JOIN users u ON u.id = a.resolved_by
        ORDER BY a.created_at DESC
        LIMIT 60'
    )->fetchAll();
    json_out(['ok' => true, 'alerts' => $rows]);
}

if ($method === 'PUT') {
    require_role($me, 'manager');
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $id   = (int) ($body['id'] ?? 0);
    if (!$id) abort('Missing alert id');

    $row = $pdo->prepare('SELECT id, room_id FROM alerts WHERE id = ? AND is_resolved = 0');
    $row->execute([$id]);
    $alert = $row->fetch();
    if (!$alert) abort('Alert not found or already resolved', 404);

    $pdo->prepare(
        'UPDATE alerts SET is_resolved = 1, resolved_by = ?, resolved_at = NOW() WHERE id = ?'
    )->execute([$me['id'], $id]);

    log_action($me['id'], $me['name'], "Resolved alert #{$id}");
    json_out(['ok' => true]);
}

abort('Method not allowed', 405);

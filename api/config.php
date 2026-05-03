<?php
// ============================================================
//  /api/config.php
//  GET  – fetch config (all authenticated)
//  PUT  – update config (admin or manager)
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
    $cfg = $pdo->query('SELECT * FROM config LIMIT 1')->fetch();
    json_out(['ok' => true, 'config' => $cfg]);
}

if ($method === 'PUT') {
    require_role($me, 'manager');
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $fields = [];
    $params = [];
    $allowed = ['warn_threshold','crit_threshold','email_alerts','sound_alerts','visual_alerts','alert_recipient'];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) {
            $fields[] = "{$f} = ?";
            $params[] = $body[$f];
        }
    }
    if (!$fields) abort('Nothing to update');

    $pdo->prepare('UPDATE config SET ' . implode(', ', $fields) . ' WHERE id = 1')
        ->execute($params);

    log_action($me['id'], $me['name'], 'Updated alert configuration');
    json_out(['ok' => true]);
}

abort('Method not allowed', 405);

<?php
// ============================================================
//  /api/readings.php – POST a new dB reading (from sensor/sim)
// ============================================================
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_helpers.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-NS-Token');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;
if ($_SERVER['REQUEST_METHOD'] !== 'POST') abort('Method not allowed', 405);

$me   = require_auth();
$pdo  = db();
$body = json_decode(file_get_contents('php://input'), true) ?? [];

$roomId = (int) ($body['room_id'] ?? 0);
$db     = (float) ($body['db_level'] ?? 0);

if (!$roomId || $db <= 0) abort('room_id and db_level required');

// Fetch config thresholds
$cfg = $pdo->query('SELECT warn_threshold, crit_threshold FROM config LIMIT 1')->fetch();
$status = 'Normal';
if ($db >= $cfg['crit_threshold']) $status = 'Critical';
elseif ($db >= $cfg['warn_threshold']) $status = 'Warning';

$pdo->prepare(
    'INSERT INTO noise_readings (room_id, db_level, status) VALUES (?, ?, ?)'
)->execute([$roomId, $db, $status]);

// Auto-create alert if non-normal
if ($status !== 'Normal') {
    $pdo->prepare(
        'INSERT INTO alerts (room_id, db_level, severity) VALUES (?, ?, ?)'
    )->execute([$roomId, $db, $status]);
}

json_out(['ok' => true, 'status' => $status]);

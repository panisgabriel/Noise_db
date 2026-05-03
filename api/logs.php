<?php
// ============================================================
//  /api/logs.php – GET activity logs (admin only)
// ============================================================
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth_helpers.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-NS-Token');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;
if ($_SERVER['REQUEST_METHOD'] !== 'GET') abort('Method not allowed', 405);

$me = require_auth();
require_role($me, 'admin');

$rows = db()->query(
   'SELECT user_name AS user, action, ip_address AS ip, created_at AS time
    FROM activity_logs
    ORDER BY created_at DESC
    LIMIT 100'
)->fetchAll();

json_out(['ok' => true, 'logs' => $rows]);

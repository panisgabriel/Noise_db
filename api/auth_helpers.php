<?php
// ============================================================
//  NoiseSense – Auth helpers
// ============================================================
require_once __DIR__ . '/db.php';

/**
 * Send JSON response and exit.
 */
function json_out(array $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

/**
 * Abort with an error JSON payload.
 */
function abort(string $message, int $status = 400): never {
    json_out(['ok' => false, 'error' => $message], $status);
}

/**
 * Return the currently authenticated user (or abort 401).
 */
function require_auth(): array {
    $token = $_COOKIE[SESSION_COOKIE] ?? $_SERVER['HTTP_X_NS_TOKEN'] ?? '';
    if (!$token) abort('Unauthenticated', 401);

    $pdo  = db();
    $stmt = $pdo->prepare(
        'SELECT s.token, s.user_id, s.expires_at,
                u.id, u.name, u.email, u.role, u.is_active
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > NOW()'
    );
    $stmt->execute([$token]);
    $row = $stmt->fetch();

    if (!$row || !$row['is_active']) abort('Session expired or user inactive', 401);

    return $row;
}

/**
 * Require a minimum role level.
 * Levels: user < manager < admin
 */
function require_role(array $user, string $min): void {
    $levels = ['user' => 1, 'manager' => 2, 'admin' => 3];
    if (($levels[$user['role']] ?? 0) < ($levels[$min] ?? 99)) {
        abort('Forbidden', 403);
    }
}

/**
 * Get the request IP address.
 */
function client_ip(): string {
    foreach (['HTTP_X_FORWARDED_FOR','HTTP_CLIENT_IP','REMOTE_ADDR'] as $k) {
        if (!empty($_SERVER[$k])) {
            return trim(explode(',', $_SERVER[$k])[0]);
        }
    }
    return '0.0.0.0';
}

/**
 * Log an activity to the DB.
 */
function log_action(?int $userId, string $userName, string $action): void {
    try {
        db()->prepare(
            'INSERT INTO activity_logs (user_id, user_name, action, ip_address)
             VALUES (?, ?, ?, ?)'
        )->execute([$userId, $userName, $action, client_ip()]);
    } catch (Throwable) { /* non-fatal */ }
}

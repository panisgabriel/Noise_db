-- ============================================================
--  NoiseSense – MySQL Schema
--  Compatible with MySQL 8.0+
--  Run:  mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS noisesense
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE noisesense;

-- ──────────────────────────────────────────────
--  1. USERS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)      NOT NULL,
  email         VARCHAR(180)      NOT NULL,
  password_hash VARCHAR(255)      NOT NULL,          -- bcrypt / password_hash()
  role          ENUM('admin','manager','user')
                                  NOT NULL DEFAULT 'user',
  is_active     TINYINT(1)        NOT NULL DEFAULT 1,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────
--  2. SESSIONS
--  Server-side session tokens for login
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  token         CHAR(64)          NOT NULL,          -- random hex token
  user_id       INT UNSIGNED      NOT NULL,
  ip_address    VARCHAR(45)       NOT NULL DEFAULT '',
  user_agent    VARCHAR(400)      NOT NULL DEFAULT '',
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME          NOT NULL,
  PRIMARY KEY (token),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────
--  3. ROOMS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)      NOT NULL,
  lat           DECIMAL(10,7)     NOT NULL DEFAULT 0,
  lng           DECIMAL(10,7)     NOT NULL DEFAULT 0,
  is_active     TINYINT(1)        NOT NULL DEFAULT 1,
  created_by    INT UNSIGNED      NULL,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_rooms_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────
--  4. NOISE READINGS  (time-series)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS noise_readings (
  id            BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  room_id       INT UNSIGNED      NOT NULL,
  db_level      DECIMAL(6,2)      NOT NULL,
  status        ENUM('Normal','Warning','Critical')
                                  NOT NULL DEFAULT 'Normal',
  recorded_at   DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_readings_room_time (room_id, recorded_at),
  CONSTRAINT fk_readings_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────
--  5. ALERTS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  room_id       INT UNSIGNED      NOT NULL,
  db_level      DECIMAL(6,2)      NOT NULL,
  severity      ENUM('Warning','Critical')
                                  NOT NULL,
  is_resolved   TINYINT(1)        NOT NULL DEFAULT 0,
  resolved_by   INT UNSIGNED      NULL,
  resolved_at   DATETIME          NULL,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_alerts_room (room_id),
  KEY idx_alerts_resolved (is_resolved),
  CONSTRAINT fk_alerts_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_alerts_resolved_by
    FOREIGN KEY (resolved_by) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────
--  6. ACTIVITY LOGS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id            BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED      NULL,              -- NULL = system event
  user_name     VARCHAR(120)      NOT NULL DEFAULT 'System',
  action        VARCHAR(400)      NOT NULL,
  ip_address    VARCHAR(45)       NOT NULL DEFAULT '',
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_logs_user (user_id),
  KEY idx_logs_created (created_at),
  CONSTRAINT fk_logs_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────
--  7. CONFIG  (single-row settings table)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  warn_threshold    INT           NOT NULL DEFAULT 65,
  crit_threshold    INT           NOT NULL DEFAULT 80,
  email_alerts      TINYINT(1)    NOT NULL DEFAULT 1,
  sound_alerts      TINYINT(1)    NOT NULL DEFAULT 0,
  visual_alerts     TINYINT(1)    NOT NULL DEFAULT 1,
  alert_recipient   VARCHAR(180)  NOT NULL DEFAULT 'admin@noisesense.com',
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ============================================================
--  SEED DATA
-- ============================================================

-- Default config row (only one ever exists)
INSERT INTO config (warn_threshold, crit_threshold, email_alerts, sound_alerts, visual_alerts, alert_recipient)
VALUES (65, 80, 1, 0, 1, 'admin@noisesense.com')
ON DUPLICATE KEY UPDATE id = id;

-- Default rooms
INSERT INTO rooms (name, lat, lng) VALUES
  ('Laboratory 1', 8.3597310, 124.8691930),
  ('Laboratory 2', 8.3596750, 124.8691800),
  ('Laboratory 3', 8.3596190, 124.8691670);

-- Default users  (passwords: admin123 / manager123 / user123 — change in production!)
-- Generated with PHP: password_hash('admin123', PASSWORD_BCRYPT)
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Admin User',   'admin@example.com',   '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
  ('Manager User', 'manager@example.com', '$2y$12$2eUYURzJWvLJKjqpHjFwRuN0sQ7k7EW5LJLYhHJnFJDtEa8NwDy8i', 'manager'),
  ('Regular User', 'user@example.com',    '$2y$12$4c/0hNB.l8hXJRN2C5jJreqHHjkB4VNIqD9c0FXvSeBPT9AaKGh3e', 'user');

-- System startup log
INSERT INTO activity_logs (user_name, action, ip_address)
VALUES ('System', 'Application started', '127.0.0.1');

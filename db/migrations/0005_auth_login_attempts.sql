-- 005_login_attempts.sql
-- Учёт неудачных попыток → блокировка после 5 (FR-AUTH-05).
CREATE TABLE IF NOT EXISTS login_attempts (
    id          BIGSERIAL PRIMARY KEY,
    user_id     TEXT REFERENCES users (id) ON DELETE CASCADE,
    login       TEXT NOT NULL,
    success     BOOLEAN NOT NULL,
    ip_addr     TEXT NOT NULL DEFAULT '',
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user_time
    ON login_attempts (user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_login_time
    ON login_attempts (login, attempted_at DESC);

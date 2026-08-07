-- 006_mfa_secrets.sql
-- TOTP-секреты для 2FA (auth.md §2): привилегированные роли (admin, instructor).
-- Секрет хранится в зашифрованном виде (приложение шифрует перед записью).
CREATE TABLE IF NOT EXISTS mfa_secrets (
    user_id     TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    secret_enc  BYTEA NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

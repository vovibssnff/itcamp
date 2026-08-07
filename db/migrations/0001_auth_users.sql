-- 001_users.sql
-- Локальные пароли НЕ хранятся (FR-AUTH-02): аутентификация через LDAP/AD.
-- users.id — строковый UUID (приложение генерирует).
CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    login        TEXT NOT NULL UNIQUE,
    full_name    TEXT NOT NULL DEFAULT '',
    ldap_dn      TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'locked', 'disabled')),
    mfa_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_login ON users (login);
CREATE INDEX IF NOT EXISTS idx_users_ldap_dn ON users (ldap_dn);

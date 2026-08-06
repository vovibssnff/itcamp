-- 0001_users.sql — таблица пользователей (plan §4, §7).
-- Picodata (PG-wire): plain SQL DDL, без Alembic autogenerate (plan §1).
-- Роли: admin|instructor|operator (FR-AUTH-03). password_hash — bcrypt.

CREATE TABLE IF NOT EXISTS users (
    id            TEXT        PRIMARY KEY,
    login         TEXT        NOT NULL UNIQUE,
    fio           TEXT        NOT NULL,
    role          TEXT        NOT NULL CHECK (role IN ('admin', 'instructor', 'operator')),
    password_hash TEXT        NOT NULL,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

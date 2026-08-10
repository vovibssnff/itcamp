-- 0100_constructor_component_types.sql
-- Библиотека типов компонентов КТС (SRD §3.2, Приложение A).
-- ports/parameters — JSONB (схема schemas/component_type.json).
CREATE TABLE IF NOT EXISTS component_types (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL CHECK (category IN ('Общие', 'ЭЛОУ', 'Атмосфера', 'ГДМ')),
    description   TEXT NOT NULL DEFAULT '',
    ports         JSONB NOT NULL DEFAULT '[]',
    parameters    JSONB NOT NULL DEFAULT '[]',
    model_code    TEXT NOT NULL DEFAULT '',
    icon_s3_key   TEXT NOT NULL DEFAULT '',
    documentation TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_component_types_category ON component_types (category);
CREATE INDEX IF NOT EXISTS idx_component_types_name ON component_types (name);

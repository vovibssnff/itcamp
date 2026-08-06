-- 0001_component_types.sql — библиотека типов компонентов (plan §4, §9.1).
-- ports/parameters — JSONB (по schemas/component_type.json). model_code — ключ ODE-класса в sim.

CREATE TABLE IF NOT EXISTS component_types (
    id            TEXT        PRIMARY KEY,
    name          TEXT        NOT NULL,
    category      TEXT        NOT NULL CHECK (category IN ('Общие', 'ЭЛОУ', 'Атмосфера', 'ГДМ')),
    description   TEXT,
    ports         JSONB       NOT NULL DEFAULT '[]'::jsonb,
    parameters    JSONB       NOT NULL DEFAULT '[]'::jsonb,
    model_code    TEXT        NOT NULL,
    icon_s3_key   TEXT,
    documentation TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_component_types_category ON component_types (category);

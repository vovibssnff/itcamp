-- 0002_scenarios.sql — сценарии (plan §4, §12.1).
-- faults/reference_actions/criteria — JSONB (по schemas/scenario.json).
-- FaultInjection перешёл в авто-событие из сценария (plan §4).

CREATE TABLE IF NOT EXISTS scenarios (
    id                TEXT        PRIMARY KEY,
    template_id       TEXT        NOT NULL REFERENCES installation_templates (id),
    name              TEXT        NOT NULL,
    description       TEXT,
    type              TEXT        NOT NULL DEFAULT 'training'
                                  CHECK (type IN ('training', 'exam')),
    start_preset_id   TEXT,
    faults            JSONB       NOT NULL DEFAULT '[]'::jsonb,
    reference_actions JSONB       NOT NULL DEFAULT '[]'::jsonb,
    criteria          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    author_id         TEXT        NOT NULL REFERENCES users (id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenarios_template ON scenarios (template_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_type ON scenarios (type);

-- 0201_scenario_scenarios.sql
-- Сценарии тренировки/экзамена (SRD §3.4 FR-SCEN-*, §3.7 FR-FLT-*).
-- faults/reference_actions/criteria — JSONB (схема schemas/scenario.json).
CREATE TABLE IF NOT EXISTS scenarios (
    id               TEXT PRIMARY KEY,
    template_id      TEXT NOT NULL DEFAULT '',
    name             TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    type             TEXT NOT NULL DEFAULT 'training'
                     CHECK (type IN ('training', 'exam')),
    start_preset_id  TEXT NOT NULL DEFAULT '',
    faults           JSONB NOT NULL DEFAULT '[]',
    reference_actions JSONB NOT NULL DEFAULT '[]',
    criteria         JSONB NOT NULL DEFAULT '{}',
    author_id        TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenarios_template ON scenarios (template_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_type ON scenarios (type);
CREATE INDEX IF NOT EXISTS idx_scenarios_name ON scenarios (name);
CREATE INDEX IF NOT EXISTS idx_scenarios_author ON scenarios (author_id);

-- 0300_orchestrator_sessions.sql
-- Сессии обучения/экзамена (SRD §3.6 FR-SESS-*).
CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT PRIMARY KEY,
    template_id   TEXT NOT NULL DEFAULT '',
    scenario_id   TEXT NOT NULL DEFAULT '',
    operator_ids  JSONB NOT NULL DEFAULT '[]',
    instructor_id TEXT NOT NULL DEFAULT '',
    mode          TEXT NOT NULL DEFAULT 'training'
                  CHECK (mode IN ('training', 'exam', 'demo')),
    speed         DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    status        TEXT NOT NULL DEFAULT 'created'
                  CHECK (status IN ('created', 'running', 'paused', 'stopped', 'finished')),
    model_time    DOUBLE PRECISION NOT NULL DEFAULT 0,
    started_at    TIMESTAMPTZ,
    stopped_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);
CREATE INDEX IF NOT EXISTS idx_sessions_instructor ON sessions (instructor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scenario ON sessions (scenario_id);

-- 0001_sessions.sql — сессии тренажёра (plan §4, §11).
-- operator_ids[] — массив назначенных операторов. model_time — секунды (float).

CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT        PRIMARY KEY,
    scenario_id   TEXT        REFERENCES scenarios (id),
    template_id   TEXT        NOT NULL REFERENCES installation_templates (id),
    instructor_id TEXT        NOT NULL REFERENCES users (id),
    operator_ids  TEXT[]      NOT NULL DEFAULT '{}',
    mode          TEXT        NOT NULL DEFAULT 'training'
                              CHECK (mode IN ('training', 'exam')),
    speed         DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    status        TEXT        NOT NULL DEFAULT 'created'
                              CHECK (status IN ('created', 'running', 'paused', 'stopped', 'finished')),
    model_time    DOUBLE PRECISION NOT NULL DEFAULT 0,
    started_at    TIMESTAMPTZ,
    stopped_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);
CREATE INDEX IF NOT EXISTS idx_sessions_instructor ON sessions (instructor_id);

-- 0301_orchestrator_operator_actions.sql
-- Журнал действий оператора (append-only, SRD FR-SESS-04).
CREATE TABLE IF NOT EXISTS operator_actions (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    type        TEXT NOT NULL,
    target      TEXT NOT NULL DEFAULT '',
    action      TEXT NOT NULL DEFAULT '',
    value       JSONB,
    model_time  DOUBLE PRECISION NOT NULL DEFAULT 0,
    server_time TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actions_session ON operator_actions (session_id, model_time);
CREATE INDEX IF NOT EXISTS idx_actions_user ON operator_actions (user_id);

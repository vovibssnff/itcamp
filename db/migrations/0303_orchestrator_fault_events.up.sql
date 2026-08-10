-- 0303_orchestrator_fault_events.sql
-- Журнал сработавших неисправностей (append-only, SRD FR-FLT-04).
CREATE TABLE IF NOT EXISTS fault_events (
    id                TEXT PRIMARY KEY,
    session_id        TEXT NOT NULL,
    fault_id          TEXT NOT NULL,
    component_instance_id TEXT NOT NULL DEFAULT '',
    trigger_type      TEXT NOT NULL DEFAULT 'time',
    fired_model_time  DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fault_events_session ON fault_events (session_id, fired_model_time);

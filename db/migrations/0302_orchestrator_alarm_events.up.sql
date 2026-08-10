-- 0302_orchestrator_alarm_events.sql
-- События алармов (SRD FR-HMI-04).
CREATE TABLE IF NOT EXISTS alarm_events (
    id                 TEXT PRIMARY KEY,
    session_id         TEXT NOT NULL,
    tag_id             TEXT NOT NULL,
    priority           TEXT NOT NULL DEFAULT 'H'
                       CHECK (priority IN ('HH', 'H', 'L', 'LL')),
    raised_model_time  DOUBLE PRECISION NOT NULL DEFAULT 0,
    ack_model_time     DOUBLE PRECISION,
    ack_user_id        TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_alarms_session ON alarm_events (session_id, raised_model_time);

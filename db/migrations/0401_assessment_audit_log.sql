-- 0401_assessment_audit_log.sql
-- Журнал переопределений оценок (append-only, FR-ASSESS-05).
CREATE TABLE IF NOT EXISTS assessment_overrides (
    id          BIGSERIAL PRIMARY KEY,
    session_id  TEXT NOT NULL,
    old_score   INTEGER NOT NULL,
    new_score   INTEGER NOT NULL,
    old_verdict TEXT NOT NULL,
    new_verdict TEXT NOT NULL,
    comment     TEXT NOT NULL,
    by_user_id  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_overrides_session ON assessment_overrides (session_id);

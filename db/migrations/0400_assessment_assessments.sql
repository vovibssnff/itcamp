-- 0400_assessment_assessments.sql
-- Оценки сессий (SRD §3.13 FR-ASSESS-*).
-- penalties/critical_errors/reaction_times — JSONB.
CREATE TABLE IF NOT EXISTS assessments (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL UNIQUE,
    penalties       JSONB NOT NULL DEFAULT '[]',
    critical_errors JSONB NOT NULL DEFAULT '[]',
    reaction_times  JSONB NOT NULL DEFAULT '[]',
    total_score     INTEGER NOT NULL DEFAULT 0,
    verdict         TEXT NOT NULL DEFAULT 'pending'
                    CHECK (verdict IN ('pending', 'pass', 'fail')),
    override_by     TEXT NOT NULL DEFAULT '',
    override_comment TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessments_session ON assessments (session_id);
CREATE INDEX IF NOT EXISTS idx_assessments_verdict ON assessments (verdict);

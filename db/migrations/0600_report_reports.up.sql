-- 0600_report_reports.sql
-- Отчёты по сессиям (SRD §3.13 FR-ASSESS-07).
-- PDF хранится в MinIO, здесь — метаданные + canonical_json.
CREATE TABLE IF NOT EXISTS reports (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL,
    type            TEXT NOT NULL DEFAULT 'session'
                    CHECK (type IN ('session', 'exam')),
    status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'processing', 'ready', 'failed')),
    canonical_json  TEXT NOT NULL DEFAULT '',
    storage_key     TEXT NOT NULL DEFAULT '',
    error           TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_session ON reports (session_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports (created_at DESC);

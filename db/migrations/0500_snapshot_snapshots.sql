-- 0500_snapshot_snapshots.sql
-- Метаданные снапшотов (SRD §3.8 FR-SNAP-04).
-- Payload хранится в MinIO (S3), здесь — только метаданные + SHA-256.
CREATE TABLE IF NOT EXISTS snapshots (
    id             TEXT PRIMARY KEY,
    session_id     TEXT NOT NULL,
    name           TEXT NOT NULL DEFAULT '',
    model_time     DOUBLE PRECISION NOT NULL DEFAULT 0,
    author_id      TEXT NOT NULL DEFAULT '',
    schema_version TEXT NOT NULL DEFAULT '2.0',
    sha256         TEXT NOT NULL,
    storage_key    TEXT NOT NULL,
    is_preset      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_session ON snapshots (session_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_preset ON snapshots (is_preset);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots (created_at DESC);

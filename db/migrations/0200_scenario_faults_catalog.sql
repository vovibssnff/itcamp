-- 0200_scenario_faults_catalog.sql
-- Каталог типовых неисправностей (SRD §3.4 FR-SCEN-01, §3.7 FR-FLT-01).
CREATE TABLE IF NOT EXISTS faults_catalog (
    fault_id                   TEXT PRIMARY KEY,
    name                       TEXT NOT NULL,
    applicable_component_types JSONB NOT NULL DEFAULT '[]',
    description                TEXT NOT NULL DEFAULT '',
    affected_tags              JSONB NOT NULL DEFAULT '[]',
    severity                   TEXT NOT NULL DEFAULT 'medium'
                               CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    damage_per_sec             DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faults_severity ON faults_catalog (severity);

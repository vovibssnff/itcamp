-- 0001_faults_catalog.sql — каталог типовых неисправностей (plan §4, §12).
-- applicable_component_types[] / affected_tags[] — массивы (plan §4).

CREATE TABLE IF NOT EXISTS faults_catalog (
    fault_id                  TEXT   PRIMARY KEY,
    name                      TEXT   NOT NULL,
    applicable_component_types TEXT[] NOT NULL DEFAULT '{}',
    description               TEXT,
    affected_tags             TEXT[] NOT NULL DEFAULT '{}',
    severity                  TEXT   NOT NULL DEFAULT 'medium'
                                     CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    damage_per_sec            DOUBLE PRECISION NOT NULL DEFAULT 0
);

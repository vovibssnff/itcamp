-- 0101_constructor_templates.sql
-- Шаблоны установок (граф + layout в JSONB).
-- graph — schemas/template_graph.json.
CREATE TABLE IF NOT EXISTS installation_templates (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    author_id   TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'published', 'archived')),
    graph       JSONB NOT NULL DEFAULT '{"schema_version":"2.0","nodes":[],"edges":[],"layout":{"mnemo_positions":{},"custom_labels":{}}}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_author ON installation_templates (author_id);
CREATE INDEX IF NOT EXISTS idx_templates_status ON installation_templates (status);
CREATE INDEX IF NOT EXISTS idx_templates_name ON installation_templates (name);

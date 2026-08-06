-- 0002_installation_templates.sql — шаблоны установок (plan §4, §9).
-- graph/layout — JSONB (по schemas/template.graph.json). Версионирование шаблонов убрано (plan §4, §23).

CREATE TABLE IF NOT EXISTS installation_templates (
    id          TEXT        PRIMARY KEY,
    name        TEXT        NOT NULL,
    description TEXT,
    author_id   TEXT        NOT NULL REFERENCES users (id),
    status      TEXT        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'published', 'archived')),
    graph       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    layout      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_author ON installation_templates (author_id);
CREATE INDEX IF NOT EXISTS idx_templates_status ON installation_templates (status);

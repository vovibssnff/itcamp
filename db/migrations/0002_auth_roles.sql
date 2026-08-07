-- 002_roles.sql
-- 3 роли RBAC (FR-ROLE-01): admin, instructor, operator.
CREATE TABLE IF NOT EXISTS roles (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT ''
);

INSERT INTO roles (id, name, description) VALUES
    ('admin',      'admin',      'Администратор: пользователи, роли, конфигурация, мониторинг'),
    ('instructor', 'instructor', 'Инструктор: шаблоны, сценарии, сессии, инъекции, оценка'),
    ('operator',   'operator',   'Оператор: прохождение сессий, HMI, своя история')
ON CONFLICT (name) DO NOTHING;

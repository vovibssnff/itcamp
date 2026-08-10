# Migrator — единый инструмент миграций Picodata

Применяет SQL-миграции из `db/migrations/` к Picodata (PostgreSQL-wire).

## Использование

```bash
# Применить все неприменённые миграции
go run ./tools/migrator up -dsn "postgres://user:pass@host:5432/ktc?sslmode=disable"

# Откатить последнюю миграцию
go run ./tools/migrator down -dsn "..." -steps 1

# Показать текущую версию
go run ./tools/migrator version -dsn "..."

# Принудительно установить версию (после ручного фикса)
go run ./tools/migrator force -dsn "..." -version 6
```

## Структура миграций

Файлы в `db/migrations/` с префиксом `NNNN_<service>_<name>.up.sql`
(golang-migrate):

```
0001_auth_users.up.sql
0100_constructor_component_types.up.sql
0200_scenario_faults_catalog.up.sql
...
```

`tools/migrator create` создаёт `.up.sql`.

Диапазоны номеров:

| Диапазон | Сервис |
|---|---|
| 0001–0099 | auth |
| 0100–0199 | constructor |
| 0200–0299 | scenario |
| 0300–0399 | orchestrator |
| 0400–0499 | assessment |
| 0500–0599 | snapshot |
| 0600–0699 | report |

Мигратор читает все файлы и применяет в порядке числового префикса.
Таблица `schema_migrations` хранит текущую версию.

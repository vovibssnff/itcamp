# AGENTS.md — конвенции проекта itcamp

## Обязательные правила при создании сервиса

### Тесты — обязательны

Каждый сервис **должен** содержать юнит-тесты для логики без внешних зависимостей (БД, LDAP, S3, HTTP-клиенты).

**Что тестировать:**
- `internal/service/*` — бизнес-логика (валидаторы, экспортёры, токены, оценка)
- `internal/security/*` — чистая логика (password policy, TOTP, маппинг ролей)
- `internal/domain/*` — модели, методы валидации
- `internal/config/*` — парсинг и валидация конфигурации

**Что НЕ нужно тестировать в юнит-тестах:**
- `internal/repository/*` — требует БД (покрывается интеграционными тестами)
- `internal/server/*` — HTTP-сервер (покрывается E2E)
- `cmd/*/main.go` — точка входа

**Паттерны:**
- Использовать интерфейсы для зависимостей (например `RefreshStore` вместо `*RefreshRepo`), чтобы тестировать с mock-ами
- Mock-и в файлах `*_test.go` рядом с тестируемым пакетом
- Имена: `Test<Subject>_<Case>` (например `TestValidator_PortTypeMismatch`)
- Табличные тесты для однотипных кейсов
- Запуск: `go test ./...` из директории сервиса

**Минимум:** каждый сервис должен иметь `go test ./...` без ошибок перед коммитом.

### Структура сервиса

Микросервисы сгруппированы по языку: Go — `services/go/<name>/`, Python — `services/python/<name>/`.

**Go-сервис:**
```
services/go/<name>/
  cmd/<name>/main.go
  internal/
    config/          — TOML-конфиг + env-override
    domain/          — модели, ошибки (без I/O)
    repository/      — Picodata (pgx), интерфейсы для тестов
    security/        — чистая логика (если есть)
    service/         — бизнес-логика, интерфейсы зависимостей
    transport/http/  — handlers, dto, middleware
    server/          — http.Server, маршруты, shutdown
  api/openapi.yaml   — REST-контракт
  deploy/            — Dockerfile, config.example.toml
  seeds/             — seed-данные (если есть)
  go.mod
  README.md
```

### Конфигурация
- Формат: TOML (флаг `-config`)
- Секреты: env-override (DSN, ключи, пароли)
- Duration-поля: кастомный тип с `UnmarshalText` + `.Std()`

### Миграции
- Централизованно в `db/migrations/` с префиксом `NNNN_<service>_*`
- Диапазоны: auth 0001-0099, constructor 0100-0199, scenario 0200-0299, ...
- Применяются через `tools/migrator`

### Общий код
Общие Go-пакеты (audit, uid, config `Duration`, db) живут в модуле `services/go/shared`
и подключаются через `replace` в `services/go/<name>/go.mod`.

### Сборка и проверка перед коммитом
```bash
cd services/go/<name>
go mod tidy
go build ./...
go vet ./...
go test ./...
```

CI (GitHub Actions): Go-модули — `golangci-lint` + `go test`/`go build` (`.github/workflows/go.yml`); Python-пакеты — `ruff`/`mypy` + тесты (`.github/workflows/python.yml`); frontend — lint/typecheck/test/e2e (`.github/workflows/frontend.yml`).

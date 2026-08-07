# API Gateway / BFF — `gw`

Единая точка входа для клиентов. Go + reverse proxy + BFF middleware.

## Назначение

- **Trust boundary** (auth.md §6): gw — единственная точка проверки JWT через `auth /introspect`
- Проверенный контекст передаётся downstream заголовками `X-User-ID` / `X-Roles`
- Внутренние сервисы токен не валидируют — доверие через mTLS + NetworkPolicy
- **RBAC** на уровне маршрута (roles в конфиге)
- **Rate limiting** per IP
- **WS-проксирование** для телеметрии
- Не хранит бизнес-данные, не ходит в sim/db/s3 напрямую

## Структура

```
cmd/gw/main.go              — точка входа
internal/
  config/                   — конфиг TOML (upstreams, routes, auth_client, security)
  auth/                     — клиент introspect + кэш токенов
  proxy/                    — reverse proxy registry + path rewrite + WS
  middleware/               — auth (introspect), inject headers, rbac, ratelimit, recover
  server/                   — http.Server, маршруты из конфига, shutdown
api/openapi.yaml            — полная таблица маршрутизации
deploy/                     — Dockerfile, config.example.toml
```

## Маршрутизация

Маршруты описаны в TOML-конфиге (`deploy/config.example.toml`). Каждый маршрут:
- `prefix` — путь-префикс (например `/api/v1/sessions`)
- `upstream` — имя upstream-сервиса
- `strip_prefix` — префикс, вырезаемый перед проксированием (обычно `/api/v1`)
- `auth` — проверять ли JWT через introspect
- `roles` — RBAC (только указанные роли)
- `websocket` — проксирование WS-upgrade

## Запуск

```bash
cp deploy/config.example.toml config.toml
# отредактировать upstreams под окружение
go run ./cmd/gw -config config.toml
```

## Health check

```
GET /healthz → 200 {"status":"ok"}
```

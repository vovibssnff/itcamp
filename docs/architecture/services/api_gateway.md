# Сервис: API Gateway / BFF — `gw`

> Язык: Go | Слой: Прикладной | HTTP: `:8088` | Сервис: `services/go/gw`

## 1. Назначение

**Единая точка входа** для всех клиентов — прикладной контрактный слой (BFF).
Это не сетевой прокси-вход: `gw` выполняет **прикладную логику входа**: проверку JWT
через `auth`, RBAC по ролям на уровне маршрута, rate-limiting, проксирование REST и
WebSocket-телеметрии к внутренним сервисам. Внутренние сервисы скрыты за единым
контрактом `/api/v1/*`.

Реализация: **Go-сервис** (обратный прокси + BFF-middleware). Это НЕ Nginx/Angie —
Angie используется только для раздачи статики фронтенда (см. `frontend.md`).

## 2. Основные функции

- **Trust boundary** (см. `auth.md` §6): `gw` — единственная точка проверки JWT через `auth /introspect`.
- Проверенный контекст передаётся downstream заголовками `X-User-ID` / `X-Roles`; сам JWT дальше не рассылается.
- **RBAC** на уровне маршрута (`roles` в таблице маршрутов).
- **Rate limiting** per IP (`security.rate_limit_per_min`).
- **Проксирование WebSocket** (телеметрия 1 Гц) с path-rewrite.
- Агрегация (BFF) и стабильный прикладной контракт.
- Не ходит в `sim`, `db`, `s3` напрямую.

## 3. Внутренняя структура

```
cmd/gw/main.go              — точка входа
internal/
  config/                   — конфиг TOML (upstreams, routes, auth_client, security)
  auth/                     — клиент introspect + кэш токенов
  proxy/                    — reverse proxy registry + path rewrite + WS
  middleware/               — auth (introspect), inject headers, rbac, ratelimit, recover
  server/                   — http.Server, маршруты из конфига, shutdown
api/openapi.yaml            — полная таблица маршрутизации
deploy/config.example.toml  — пример конфигурации
```

## 4. Конфигурация

Формат — **TOML** (`deploy/config.example.toml`). Путь через флаг `-config`.

| Секция | Назначение |
|---|---|
| `[http]` | адрес/таймауты HTTP-сервера |
| `[auth_client]` | URL `auth /introspect`, timeout, кэш токенов (ttl/размер) |
| `[security]` | `rate_limit_per_min` |
| `[upstreams.*]` | адреса внутренних сервисов (auth, constructor, scenario, orchestrator, assessment, snapshot, report, ai) |
| `[[routes]]` | таблица маршрутизации `/api/v1/*` → upstream |

Каждый маршрут (`[[routes]]`):
- `prefix` — путь-префикс (например `/api/v1/sessions`);
- `upstream` — имя upstream-сервиса;
- `strip_prefix` — префикс, вырезаемый перед проксированием (обычно `/api/v1`);
- `auth` — проверять ли JWT через introspect (`false` для публичных `/login`, `/refresh`);
- `roles` — RBAC (только указанные роли);
- `websocket` — проксирование WS-upgrade.

## 5. API / контракты

Наружу отдаёт `/api/v1/*`. Полная таблица маршрутизации — в `api/openapi.yaml` и в
`deploy/config.example.toml` (таблица `[[routes]]`).

## 6. Данные

- Не хранит бизнес-данные.
- Кэширует валидацию токенов в памяти (JWT validation cache).
- Секреты (ключ подписи JWT) — во владении `auth`; `gw` обращается через `/introspect`.

## 7. Метрики

- HTTP-коды (2xx/4xx/5xx), задержки, число активных WS-соединений.
- Срабатывания rate-limit, ошибки авторизации, число маршрутизаций на upstream.

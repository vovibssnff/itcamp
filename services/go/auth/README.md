# Auth Service — `auth`

Аутентификация и RBAC для Конструктора КТК. Go + REST.

## Назначение

- Аутентификация через **LDAP/AD** → выдача **JWT** (access 15м + refresh 24ч, ротация) — FR-AUTH-01/06
- **RBAC**: 3 роли (admin, instructor, operator) — FR-ROLE-01
- **2FA (TOTP)** для привилегированных ролей — auth.md §2
- **Trust boundary**: `gw` проверяет токен через `POST /introspect`; внутренние сервисы токен не валидируют — auth.md §6
- **Lockout** после 5 неудачных попыток — FR-AUTH-05
- Аудит входов → KUMA

## Структура

```
cmd/auth/main.go              — точка входа
internal/
  config/                     — конфиг TOML + env-override для секретов
  domain/                     — модели (User, Role, Token, errors)
  repository/                 — Picodata (pgx): user, refresh, mfa, login_attempt
  security/                   — ldap, password policy, totp, pam
  service/                    — бизнес-логика: auth, token, user, mfa, introspect, audit
  transport/http/             — REST: handlers, dto, middleware
  server/                     — http.Server, маршруты, shutdown
api/openapi.yaml              — REST-контракт
deploy/                       — Dockerfile, config.example.toml

Миграции — централизованно в db/migrations/ (префикс 0001-0099_auth_*)
```

## Запуск (локально)

```bash
# 1. Применить миграции к Picodata (PostgreSQL-wire)
#    Миграции хранятся централизованно в db/migrations/ (диапазон 0001-0099 — auth)
for f in ../db/migrations/0*_auth_*.sql; do psql "$AUTH_DB_DSN" -f "$f"; done

# 2. Скопировать пример конфига и заполнить
cp deploy/config.example.toml config.toml
# отредактировать config.toml (или задать секреты через env)

# 3. Запустить
go run ./cmd/auth -config config.toml

# Секреты можно перекрыть env-переменными (не хранить в файле):
AUTH_DB_DSN="postgres://..." \
AUTH_JWT_SIGNING_KEY="..." \
AUTH_LDAP_BIND_PASSWORD="..." \
go run ./cmd/auth -config config.toml
```

## Конфигурация

Формат — TOML (`deploy/config.example.toml`). Путь через флаг `-config` (по умолчанию `./config.toml`).

Секции: `http`, `db`, `jwt`, `ldap`, `pam`, `security`. Duration-поля в формате Go (`"15s"`, `"24h"`, `"500ms"`).

Env-override для секретов: `AUTH_DB_DSN`, `AUTH_JWT_SIGNING_KEY`, `AUTH_LDAP_BIND_PASSWORD`, `AUTH_LDAP_URL`.

## Health check

```
GET /healthz → 200 {"status":"ok"}
```

## API

См. `api/openapi.yaml`. Основные эндпоинты:

| Метод | Путь | Назначение |
|---|---|---|
| POST | /login | LDAP-аутентификация → JWT |
| POST | /refresh | Ротация refresh-токена |
| POST | /logout | Отзыв refresh-токена |
| GET  | /me | Профиль текущего пользователя |
| POST | /introspect | Проверка JWT для gw (trust boundary) |
| GET/POST | /users | CRUD пользователей (Admin) |
| GET/PUT/DELETE | /users/{id} | Управление пользователем |
| POST | /users/{id}/mfa/setup | Генерация TOTP-секрета |
| POST | /users/{id}/mfa/enable | Включение MFA |
| GET | /users/{id}/mfa | Статус MFA |

## Соответствие требованиям

| Требование | Реализация |
|---|---|
| FR-AUTH-01 | LDAP bind в `security/ldap.go` → JWT в `service/token_service.go` |
| FR-AUTH-02 | Локальных паролей нет; `users` без `password_hash` |
| FR-AUTH-03 | `domain/role.go`: 3 роли |
| FR-AUTH-05 | `repository/login_attempt_repo.go` + блокировка в `auth_service.go` |
| FR-AUTH-06 | access 15м, refresh 24ч, ротация в `token_service.go` |
| FR-ROLE-02 | `service/user_service.go` (Create/Update/Delete) |
| NFR-SEC-05 | `middleware/ratelimit.go` (auth ≤10/мин) |
| auth.md §6 | `POST /introspect` — единственная точка валидации для gw |

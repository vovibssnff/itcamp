# Сервис: Auth / Session Service — `auth`

> Язык: Go | Слой: Прикладной | HTTP: `:8082` (за gw) | СЕРВИС: `services/go/auth`

## 1. Назначение

**Идентификация и управление доступом (IAM)** — аутентификация, эмиссия JWT и RBAC.
Единственный сервис, владеющий секретом подписи JWT и статусом сессий. Через `gw`
выполняет прикладную проверку токенов для всех остальных сервисов (trust boundary).

Реализация: **Go + REST** + Picodata (PostgreSQL-wire через pgx) + LDAP-библиотека.

## 2. Основные функции

- Аутентификация: **LDAP/AD** (prod) или **stub**-пользователи (dev без LDAP) — `auth.mode`.
- Эмиссия **JWT** с ротацией: access TTL 15м, refresh TTL 24ч (FR-AUTH-06).
- **RBAC**: 3 роли — `admin`, `instructor`, `operator` (FR-ROLE-01).
- **2FA (TOTP)** для привилегированных ролей (инструктор/админ) — `services/go/auth/internal/security`.
- **Trust boundary**: `gw` проверяет токен через `POST /introspect`; внутренние сервисы токен сами не валидируют (auth.md §6).
- **Lockout** после 5 неудачных попыток (FR-AUTH-05).
- Аудит входов/отказов.

## 3. Внутренняя структура

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
deploy/config.example.toml    — пример конфигурации
```

Миграции — централизованно в `db/migrations/` (префикс `0001-0099_auth_*`).

## 4. Конфигурация

Формат — **TOML** (`deploy/config.example.toml`), путь через флаг `-config`
(по умолчанию `./config.toml`). Duration-поля в формате Go (`"15s"`, `"24h"`, `"500ms"`).

| Секция | Назначение |
|---|---|
| `[http]` | адрес/таймауты HTTP-сервера |
| `[db]` | DSN и пул соединений Picodata |
| `[jwt]` | ключ подписи (HS256), TTL access/refresh, issuer |
| `[auth]` | режим аутентификации: `ldap` (prod) / `stub` (dev); stub_users |
| `[ldap]` | URL, bind DN, base DN, фильтры, группы ролей |
| `[pam]` | интеграция с PAM (отечественный) для привилегированного доступа |
| `[security]` | политика паролей / блокировки |

Секреты перекрываются env-переменными (не держать в файле):

```
AUTH_DB_DSN="postgres://..." \
AUTH_JWT_SIGNING_KEY="..." \
AUTH_LDAP_BIND_PASSWORD="..." \
AUTH_LDAP_URL="..." \
go run ./cmd/auth -config config.toml
```

Stub-режим для локальной разработки: задать `[auth] mode = "stub"` и список
`[[auth.stub_users]]` (login/password/full_name/roles).

## 5. Trust boundary (единственная точка валидации)

- Внешний вход один — через `gw`.
- `gw` при запросе зовёт `POST /introspect` → получает валидность и роли.
- Проверенный контекст `gw` передаёт downstream заголовками `X-User-ID`/`X-Roles`; **JWT дальше не рассылается**, внутренние сервисы ключ не знают.
- Сервисы обязаны стирать входящие `X-User-ID`/`X-Roles` от клиента.

## 6. API / контракты

| Метод | Путь | Назначение |
|---|---|---|
| POST | /login | LDAP-аутентификация → JWT |
| POST | /refresh | Ротация refresh-токена |
| POST | /logout | Отзыв refresh-токена |
| GET | /me | Профиль текущего пользователя |
| POST | /introspect | Проверка JWT для gw (trust boundary) |
| GET/POST | /users | CRUD пользователей (Admin) |
| GET/PUT/DELETE | /users/{id} | Управление пользователем |
| POST | /users/{id}/mfa/setup | Генерация TOTP-секрета |
| POST | /users/{id}/mfa/enable | Включение MFA |
| GET | /users/{id}/mfa | Статус MFA |

## 7. Данные

- Picodata: пользователи, роли, профили, refresh-токены, попытки входа, MFA-секреты.
- Паролей в открытом виде нет (LDAP/AD хранит сам, `users` без `password_hash`).

## 8. Метрики

- Число успешных/неудачных входов, задержки LDAP, отказы 2FA, число активных сессий.

## 9. Соответствие требованиям

| Требование | Реализация |
|---|---|
| FR-AUTH-01 | LDAP bind → JWT |
| FR-AUTH-03 | 3 роли |
| FR-AUTH-05 | lockout после 5 попыток |
| FR-AUTH-06 | access 15м / refresh 24ч / ротация |
| NFR-SEC-05 | rate-limit (auth ≤10/мин) |
| §6 trust boundary | `POST /introspect` — единственная точка валидации |

# Сервис: Auth Service — `auth`

> Слой: Прикладной | Namespace: `ktc-app` | Под: `auth`

## 1. Назначение

**Идентификация и управление доступом** — регистрация, аутентификация и авторизация пользователей. Локальная база пользователей (без внешних каталогов). Выдача и проверка JWT-токенов. Чувствителен к правам — выносится в изолированный сегмент, масштабируется отдельно.

## 2. Основные функции

- Регистрация пользователей (Админ создаёт учётки).
- Аутентификация: проверка login/password → выдача **JWT** (access + refresh).
- **RBAC** по 3 ролям: Админ, Инструктор, Оператор.
- Ротация refresh-токенов, logout (blacklist refresh в Radix).
- Аудит входов/выходов/ошибок → KUMA.
- Управление профилями (смена пароля, блокировка).

## 3. Технологии

Python/FastAPI. JWT (PyJWT / python-jose), bcrypt (хэширование паролей), Picodata (хранение), Radix (blacklist токенов).

## 4. Внутренняя структура

- Эмиссия/валидация JWT-токенов (подпись ключом, известным `gw`).
- Хранение пользователей/ролей в Picodata (login, password_hash, role, is_active, created_at).
- Модуль RBAC (проверка полномочий по роли).
- Модуль аудита, публикация событий (Fluent Bit → KUMA).

## 5. API / контракты

| Направление | Протокол | Методы |
|---|---|---|
| от `gw` | HTTPS/REST | `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `GET /auth/me` |
| от `gw` (админ) | HTTPS/REST | `POST /users`, `GET /users`, `PUT /users/{id}`, `DELETE /users/{id}` |
| от `gw` | HTTPS/REST | `POST /auth/introspect` (валидация JWT для других сервисов) |

## 6. Зависимости и протоколы

| Взаимодействует с | Тип | Протокол |
|---|---|---|
| API Gateway (`gw`) | микросервис | HTTPS/REST, mTLS |
| Picodata (`db`) | СУБД | SQL (PostgreSQL-wire), TCP/mTLS |
| Radix (`cache`) | кэш | Redis-протокол (blacklist refresh-токенов) |
| Fluent Bit / KUMA | observability/ИБ | логи, события аудита |
| istiod / mesh | инфраструктура | mTLS |

## 7. Данные

- Picodata: таблица `users` (id, login, password_hash, role, is_active, created_at, updated_at).
- Radix: blacklist отозванных refresh-токенов (TTL = срок жизни refresh).
- Пароли хранятся только в виде bcrypt-хэша.

## 8. Объекты Kubernetes (namespace `ktc-app`)

| Объект | Описание |
|---|---|
| Deployment `auth` | N≥2 реплики, HPA |
| Service `auth` | ClusterIP |
| NetworkPolicy | accept только от `gw`; egress к Picodata, Radix |
| Secret | ключ подписи JWT (из секрет-хранилища) |
| Pod + sidecar `istio-proxy` | mTLS |

## 9. Метрики (в Пульт + Графиня)

- Число успешных/неудачных входов.
- Число активных access/refresh токенов.
- Задержки эмиссии/валидации JWT.
- Размер blacklist в Radix.

## 10. Отказоустойчивость / масштабирование

- Stateless, HPA.
- JWT-валидация не зависит от БД (подпись проверяется локально по публичному ключу).
- Blacklist в Radix: при его недоступности — graceful degradation (токены живут до истечения TTL).

## 11. Открытые вопросы

1. Срок жизни access-токена (рекомендация: 15 мин) и refresh (рекомендация: 7 дней).
2. Алгоритм подписи JWT (RS256 vs ES256).
3. Механизм первоначального создания Админа (seed при развёртывании).

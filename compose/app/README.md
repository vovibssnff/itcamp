# compose/app — слой ktc-app (сервисы приложения ktc)

Docker Compose для поднятия всех сервисов приложения (`auth`, `constructor`,
`scenario`, `orchestrator`, `assessment`, `snapshot`, `report`, `gw`).

> Data-plane (PostgreSQL/Radix-станд-ин, MinIO, NATS, Redis) здесь **не** поднимается.
> Он запускается из слоя `compose/data/compose.yaml`,
> который также прогоняет миграции БД (см. «Миграции» ниже).

## Структура

```
compose/app/
├── compose.yaml            # сервисы приложения
├── .env.example            # шаблон секретов (скопировать в .env)
├── .gitignore              # игнорирует .env
├── config/*.toml           # предзаполненные конфиги для локального запуска
└── README.md
```

## Быстрый старт

```bash
# 1) Скопировать секреты
cp .env.example .env

# 2) Поднять data-plane (PostgreSQL, MinIO, NATS, Redis)
cd ../data && cp .env.example .env && docker compose up -d
cd ../app

# 3) Поднять сервисы приложения (первый раз с --build)
docker compose up -d --build

# 4) Просмотр логов / статуса
docker compose ps
docker compose logs -f gw
```

Проверить контракты можно файлами из `helper/*.http` (в корне репозитория).

## Порты наружу

| Сервис | Хост-порт | Переменная |
|--------|-----------|------------|
| assessment | 8081 | `HTTP_ASSESSMENT` |
| auth | 8082 | `HTTP_AUTH` |
| constructor | 8083 | `HTTP_CONSTRUCTOR` |
| scenario | 8084 | `HTTP_SCENARIO` |
| orchestrator | 8085 | `HTTP_ORCHESTRATOR` |
| snapshot | 8086 | `HTTP_SNAPSHOT` |
| report | 8087 | `HTTP_REPORT` |
| gw (вход) | 8088 | `HTTP_GW` |

## Пользователи auth (stub-режим)

auth в dev-окружении работает в режиме `stub` (без LDAP). Пользователи
задаются в `config/auth.toml` (`[[auth.stub_users]]`), пароль — из `.env`
или прямо в конфиге:

| Логин | Пароль | Роли |
|-------|--------|------|
| `admin` | `admin123` | `admin` |
| `instructor` | `instructor123` | `instructor` |
| `operator` | `operator123` | `operator` |

Эти же пользователи используются в `helper/auth.http` / `helper/gw.http`
(после `login` токен сохраняется в переменные `access_token`/`refresh_token`).

## Миграции

Миграции БД прогоняются **в слое data** (`compose/data`): одиноразовая задача
`migrate` на основе `tools/migrator` (golang-migrate) применяет `db/migrations/`
к PostgreSQL сразу после поднятия data-plane.

Сервисы приложения не ждут миграций через `depends_on` (они в другом
compose-проекте); при недоступности БД сервис рестартует
(`restart: unless-stopped`) до готовности БД.

Принудительно перезапустить миграции:

```bash
cd compose/data
docker compose run --rm migrate
```

## Секреты

Все секреты вынесены в `compose/app/.env` (см. `.env.example`): DSN БД,
JWT-ключи, MinIO-ключи, NATS/Redis. Значения подставляются в контейнеры через
`environment`, а конфиги в `config/*.toml` содержат dev-значения по умолчанию
и при необходимости перекрываются env-переменными сервисов.

## Замечания

- Сборка `auth` использует `services/go/auth/deploy/Dockerfile` (как и остальные
  Go-сервисы), построенный под контекст `services/go` (`COPY auth/ ...`,
  replace ../shared резолвится корректно). Неиспользуемый `COPY db/migrations`
  убран — миграции auth применяет центральный migrator.
- Команды `docker compose down` останавливают только сервисы приложения;
  data-plane продолжает работать.

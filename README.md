# КТК — Компьютерный тренажёрный комплекс

Тренажёрная платформа для подготовки операторов технологических установок (ЭЛОУ-АВТ).
Позволяет отрабатывать нештатные ситуации на мнемосхеме, проводить экзамены
и анализировать результаты.

---

## Архитектура

```
                      Browser / SPA (React)
                              │ HTTPS
                      ┌───────┴────────┐
                      │  Angie  (nginx)│  :8090
                      │  /api/* → gw  │
                      └───────┬────────┘
                              │ HTTP
                      ┌───────┴────────┐
                      │   gw  (Go BFF) │  :8088
                      │  JWT·RBAC·rate │
                      └──┬──┬──┬──┬───┘
               ┌─────────┘  │  │  └─────────┐
           auth│        cons│  │scen    orch │
          :8082│        :8083  │:8084   :8085│
               │             │             │
        ┌──────┴──────┐  ┌───┴───┐  ┌─────┴──────┐
        │ assessment  │  │snapsh.│  │   report   │
        │    :8081    │  │ :8086 │  │    :8087   │
        └─────────────┘  └───────┘  └────────────┘
                │ NATS / Postgres / Redis / MinIO
        ┌───────┴──────────────────────────────┐
        │              ktc-data                │
        │  Postgres · Redis · MinIO · NATS     │
        └──────────────────────────────────────┘
                   ↑ DNS alias "ai"
        ┌──────────┴────────────┐
        │    ai-service (Py)    │  :8089
        │    Ollama (LLM)       │  :11434
        └───────────────────────┘
```

WebSocket `/api/v1/ws/sessions/{id}/operator|observe` проксируется gw → orchestrator.

---

## Структура репозитория

```
├── compose/                 # Docker Compose слои (data / app / ai)
│   ├── README.md            # Подробная инструкция по деплою
│   ├── data/                # ktc-local: Postgres, Redis, MinIO, NATS, migrate
│   ├── app/                 # ktc-dev: все Go-сервисы + frontend
│   └── ai/                  # ktk-ai: ai-service + Ollama
├── db/migrations/           # Централизованные SQL-миграции (golang-migrate)
├── frontend/                # React 18 SPA (Vite · TypeScript · openapi-fetch)
├── services/
│   ├── go/
│   │   ├── shared/          # Общие пакеты (audit, uid, metrics, db)
│   │   ├── auth/            # JWT, TOTP, LDAP-интеграция
│   │   ├── constructor/     # Шаблоны установок, библиотека компонентов
│   │   ├── scenario/        # Каталог сценариев, неисправности
│   │   ├── orchestrator/    # Управление сессиями, WS-хаб, симуляция
│   │   ├── assessment/      # Оценка, штрафы, replay
│   │   ├── snapshot/        # Чекпоинты, пресеты (S3)
│   │   ├── report/          # PDF-отчёты (S3 + NATS)
│   │   ├── sim-manager/     # Жизненный цикл симуляторов (k8s / compose)
│   │   └── gw/              # API Gateway / BFF (reverse-proxy + RBAC)
│   └── python/
│       ├── ai/              # База знаний, чат (FastAPI + Ollama)
│       └── sim-engine/      # Физическая модель ЭЛОУ-АВТ (Python worker)
├── tools/migrator/          # CLI-мигратор (golang-migrate wrapper)
└── docs/                    # Архитектурные решения, регламенты
```

---

## Быстрый старт (локальный деплой)

### Требования

- Docker Engine ≥ 26 с Compose v2
- 16 ГБ RAM (с Ollama), 8 ГБ (stub-режим без LLM)
- ~20 ГБ диска (модель Ollama + образы)

### 1. Клонировать и настроить `.env`

```bash
git clone https://github.com/vovibssnff/itcamp.git
cd itcamp

cp compose/data/.env.example  compose/data/.env
cp compose/app/.env.example   compose/app/.env
cp compose/ai/.env.example    compose/ai/.env
```

Секреты в `compose/app/.env` (обязательно сменить в продакшене):

```env
JWT_SIGNING_KEY=dev-only-signing-key-please-change-1234567890
TOTP_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
```

### 2. Запустить инфраструктурный слой

```bash
docker compose --env-file compose/data/.env -f compose/data/compose.yaml up -d
```

Ждём healthy (~10 с):

```bash
docker compose --env-file compose/data/.env -f compose/data/compose.yaml ps
```

### 3. Запустить прикладной слой

```bash
docker compose --env-file compose/app/.env -f compose/app/compose.yaml up -d --build
```

При первом старте автоматически применяются seed-данные:
компоненты ЭЛОУ-АВТ, шаблон установки и 10 учебных / экзаменационных сценариев.

### 4. Запустить ИИ-слой

```bash
docker compose --env-file compose/ai/.env -f compose/ai/compose.yaml up -d --build
```

Загрузить модель (первый раз, ~8 ГБ):

```bash
docker compose --env-file compose/ai/.env -f compose/ai/compose.yaml \
  exec ollama ollama pull qwen2.5:14b-instruct
```

> **Без GPU?** Установите `KTK_LLM_PROVIDER=stub` в `compose/ai/.env` перед шагом 4.
> Чат будет использовать детерминированные ответы по регламенту.

### 5. Проверить

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "ktc-|ktk-"
```

Открыть в браузере: **http://localhost:8090**

---

## Эндпоинты

| Сервис | URL |
|---|---|
| **Frontend** | http://localhost:8090 |
| API Gateway | http://localhost:8088 |
| AI service | http://localhost:8089 |
| Auth | http://localhost:8082 |
| Constructor | http://localhost:8083 |
| Scenario | http://localhost:8084 |
| Orchestrator | http://localhost:8085 |
| Assessment | http://localhost:8081 |
| Snapshot | http://localhost:8086 |
| Report | http://localhost:8087 |
| MinIO Console | http://localhost:9001 |
| NATS Monitor | http://localhost:8222 |

Подробная инструкция по деплою — [`compose/README.md`](compose/README.md).

---

## Разработка

### Go-сервисы

```bash
cd services/go/<name>
go mod tidy
go build ./...
go vet ./...
go test ./...
```

### Frontend

```bash
cd frontend
pnpm install
pnpm dev          # dev-сервер на :5173 (с VITE_MOCK_API=true — без backend)
pnpm typecheck    # TypeScript
pnpm lint         # ESLint
pnpm test         # Vitest unit-тесты
pnpm openapi:gen  # Регенерация типов из OpenAPI-спеков
```

### Python

```bash
cd services/python/ai
uv sync
uv run pytest
uv run ruff check .
uv run mypy src/
```

---

## CI

| Workflow | Триггер | Что проверяет |
|---|---|---|
| `.github/workflows/go.yml` | push / PR | golangci-lint · go test · go build |
| `.github/workflows/frontend.yml` | push / PR | ESLint · typecheck · vitest |
| `.github/workflows/python.yml` | push / PR | ruff · mypy · pytest |
| `.github/workflows/security.yml` | push / PR | trivy · semgrep |

---

## Роли пользователей

| Роль | Доступ |
|---|---|
| `admin` | Все функции + управление пользователями |
| `instructor` | Создание шаблонов / сценариев / сессий, просмотр результатов |
| `operator` | Проведение тренировки / экзамена, просмотр своих результатов |

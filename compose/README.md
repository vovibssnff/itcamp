# Локальный запуск стека КТК

Стек разбит на пять Docker Compose-слоёв, эмулирующих Deckhouse-неймспейсы.
Все слои разделяют сеть `ktc-data` (создаётся слоем `data`).

```
compose/
  data/        ← ktc-local : Picodata · Radix (Redis) · MinIO · NATS · migrate
  app/         ← ktc-dev   : auth · constructor · scenario · orchestrator · assessment · snapshot · report · gw · frontend
  sim/         ← ktk-sim   : sim-manager · sim-worker (телеметрия ЭЛОУ-АВТ)
  ai/          ← ktk-ai    : ai-service · ollama (опционально)
  monitoring/  ← ktk-mon   : prometheus · grafana · cadvisor (опционально)
```

> Для живой телеметрии/неисправностей в операторской сессии поднимите
> `compose/sim` вместе с `compose/app` (DNS `sim-worker:8081` совпадает с
> `orchestrator.toml`). Без sim orchestrator использует MockSim с теми же
> tag ID (`"PRSA 204"`, …), но без полной физики.

---

## Требования

| | |
|---|---|
| Docker Engine | ≥ 26 |
| Docker Compose | v2 (`docker compose version`) |
| Свободный диск | ~20 ГБ (модель Ollama) |

---

## Первичная настройка (один раз)

```bash
cp compose/data/.env.example compose/data/.env
cp compose/app/.env.example  compose/app/.env
cp compose/ai/.env.example   compose/ai/.env
```

При необходимости отредактируйте секреты в `compose/app/.env`:

| Переменная | Описание |
|---|---|
| `JWT_SIGNING_KEY` | Минимум 32 байта, HS256 |
| `TOTP_ENCRYPTION_KEY` | Ровно 32 байта, AES-256 |
| `DB_PASSWORD` | Пароль БД (Picodata/Postgres) |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | MinIO credentials |

---

## Запуск

### Шаг 1 — Инфраструктурный слой (`ktc-local`)

Создаёт сеть `ktc-data`, поднимает Picodata, Radix (Redis), MinIO, NATS и применяет DB-миграции.

```bash
cd /Users/shcherbakov.a.m/GolandProjects/opesource/itcamp

docker compose --env-file compose/data/.env -f compose/data/compose.yaml up -d
```

Дождитесь healthy-статуса (~10 с):

```bash
docker compose --env-file compose/data/.env -f compose/data/compose.yaml ps
```

### Шаг 2 — Прикладной слой (`ktc-dev`)

Собирает и запускает все Go-микросервисы и фронтенд-SPA.

```bash
docker compose --env-file compose/app/.env -f compose/app/compose.yaml up -d --build
```

> При первом запуске включены seed-данные (`seed.enabled = true` в конфигах):
> компоненты ЭЛОУ-АВТ, шаблон установки и 10 учебных/экзаменационных сценариев.

### Шаг 2b — Симулятор (`ktk-sim`, для live HMI)

Нужен для реальной телеметрии и каталога неисправностей `FLT-*` в тренировке/экзамене.

```bash
cp compose/sim/.env.example compose/sim/.env
docker compose --env-file compose/sim/.env -f compose/sim/compose.yaml up -d --build
```

### Шаг 3 — ИИ-слой (`ktk-ai`)

Запускает Ollama и ai-service.

```bash
docker compose --env-file compose/ai/.env -f compose/ai/compose.yaml up -d --build
```

**Первый запуск — загрузка модели** (~8 ГБ, занимает 5–15 мин в зависимости от канала):

```bash
docker compose --env-file compose/ai/.env -f compose/ai/compose.yaml \
  exec ollama ollama pull qwen2.5:14b-instruct
```

> **Нет GPU / мало RAM?**
> Перед шагом 3 установите `KTK_LLM_PROVIDER=stub` в `compose/ai/.env`.
> Чат базы знаний будет использовать детерминированные ответы по регламенту
> вместо реального LLM.

### Шаг 4 — Мониторинг (`ktk-mon`, опционально)

Поднимает Prometheus + Grafana + cAdvisor для метрик платформы и контейнеров.

```bash
cp compose/monitoring/.env.example compose/monitoring/.env
docker compose --env-file compose/monitoring/.env -f compose/monitoring/compose.yaml \
  up -d --build
```

> Пока собран только core (prometheus + grafana + cadvisor). Пер-сервисные
> `targets` в `prometheus.yml` уже заведены и «оживут», когда сервисы начнут
> экспонировать `/metrics` в формате Prometheus.

---

## Проверка

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "ktc-|ktk-"
```

Ожидаемый вывод:

```
ktc-local-picodata-1     Up ... (healthy)
ktc-local-radix-1        Up ... (healthy)
ktc-local-minio-1        Up ... (healthy)
ktc-local-nats-1         Up ... (healthy)
ktc-dev-auth-1           Up ...
ktc-dev-constructor-1    Up ...
ktc-dev-scenario-1       Up ...
ktc-dev-orchestrator-1   Up ...
ktc-dev-assessment-1     Up ...
ktc-dev-snapshot-1       Up ...
ktc-dev-report-1         Up ...
ktc-dev-gw-1             Up ...
ktc-dev-frontend-1       Up ... (healthy)
ktk-sim-sim-manager-1    Up ...
ktk-sim-sim-worker-1     Up ... (healthy)
ktk-ai-ollama-1          Up ...
ktk-ai-ai-service-1      Up ... (healthy)
ktk-mon-prometheus-1     Up ...
ktk-mon-grafana-1        Up ...
ktk-mon-cadvisor-1       Up ...
```

---

## Эндпоинты

| Сервис | URL | Описание |
|---|---|---|
| **Frontend (SPA)** | http://localhost:8090 | Основная точка входа |
| API Gateway | http://localhost:8088 | `/api/v1/*` |
| AI service | http://localhost:8089 | `/v1/chat`, `/v1/explain` |
| Auth | http://localhost:8082 | |
| Constructor | http://localhost:8083 | |
| Scenario | http://localhost:8084 | |
| Orchestrator | http://localhost:8085 | |
| Assessment | http://localhost:8081 | |
| Snapshot | http://localhost:8086 | |
| Report | http://localhost:8087 | |
| Ollama | http://localhost:11434 | |
| MinIO Console | http://localhost:9001 | |
| NATS Monitor | http://localhost:8222 | |
| Prometheus | http://localhost:9090 | |
| Grafana | http://localhost:3000 | admin/admin |
| cAdvisor | http://localhost:18080 | |

---

## Остановка

```bash
# Остановить все слои (данные сохраняются):
docker compose --env-file compose/monitoring/.env -f compose/monitoring/compose.yaml down
docker compose --env-file compose/ai/.env  -f compose/ai/compose.yaml  down
docker compose --env-file compose/app/.env -f compose/app/compose.yaml down
docker compose --env-file compose/data/.env -f compose/data/compose.yaml down
docker compose --env-file compose/sim/.env  -f compose/sim/compose.yaml  down

# Полный сброс включая volumes (БД, модели):
docker compose --env-file compose/monitoring/.env -f compose/monitoring/compose.yaml down -v
docker compose --env-file compose/ai/.env  -f compose/ai/compose.yaml  down -v
docker compose --env-file compose/app/.env -f compose/app/compose.yaml down -v
docker compose --env-file compose/data/.env -f compose/data/compose.yaml down -v
docker compose --env-file compose/sim/.env  -f compose/sim/compose.yaml  down -v
```

---

## Пересборка после изменений в коде

```bash
# Пересобрать только изменённые сервисы:
docker compose --env-file compose/app/.env -f compose/app/compose.yaml \
  up -d --build <service-name>

# Например, после изменений в gw и frontend:
docker compose --env-file compose/app/.env -f compose/app/compose.yaml \
  up -d --build gw frontend
```

---

## Архитектура сети

```
                     ┌────────────────────────────────────────────────┐
                     │                сеть: ktc-data                   │
  ┌─────────────┐    │  ┌──────────┐  ┌──────┐ ┌───────────┐ ┌─────┐  │
  │  ktc-local  │    │  │  ktc-dev │  │      │ │  ktk-sim  │ │ ktk-│  │
  │             │    │  │          │  │  gw  │ │           │ │ ai  │  │
  │ picodata    │────┤  │ auth     │  │:8088 │ │ sim-      │ │ ai- │  │
  │ radix(redis)│    │  │ construc.│──│──────┤ │ manager   │ │srvce│  │
  │ minio       │    │  │ scenario │  │      │ │ sim-      │ │ alias:│ │
  │ nats        │    │  │ orchestr.│  │      │ │ worker    │ │ "ai"│  │
  │ migrate     │    │  │ assessm. │  │      │ │           │ │     │  │
  └─────────────┘    │  │ snapshot │  │      │ └───────────┘ │ollama│  │
                     │  │ report   │  │      │               │     │  │
                     │  │ frontend │  │      │               │     │  │
                     │  └──────────┘  └──────┘               └─────┘  │
                     │  ktk-mon (prometheus · grafana · cadvisor)     │
                     └────────────────────────────────────────────────┘
```

DNS-имя `ai` (network alias на `ktc-data`) позволяет `gw` обращаться к
ai-service из другого Compose-проекта по `http://ai:8080/v1`.

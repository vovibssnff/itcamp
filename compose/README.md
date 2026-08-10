# Docker Compose — слои платформы КТК

Единое место для всех docker-compose платформы, разбитых по слоям/плоскостям
архитектуры (соответствует namespace'ам из ARCHITECTURE.md и SRD §7.9):

| Каталог | Слой | Что поднимает | Сеть |
|---------|------|---------------|------|
| `compose/data/` | **ktc-data** | PostgreSQL (род. Picodata CE), Redis (род. Radix), MinIO (S3), NATS JetStream, миграции | `ktc-data` |
| `compose/app/` | **ktc-app** | Сервисы приложения: auth, constructor, scenario, orchestrator, assessment, snapshot, report, gw | `ktc-data` + `dev-app` |
| `compose/ai/`  | **ktk-ai**   | ai-service + Ollama (LLM) | `ktc-data` |
| `compose/sim/` | **ktk-sim**  | sim-manager (диспетчер Simulation Engine) + sim-worker (Model API) | `ktc-data` |
| `compose/monitoring/` | **ktk-mon** | Prometheus + Grafana + cAdvisor (метрики всех контейнеров) | `ktc-data` |

Все слои делят общую сеть `ktc-data` (создаётся слоем `data`), поэтому сервисы
приложения и ИИ видят data-plane и друг друга по DNS-именам контейнеров.

## Структура

```
compose/
├── README.md
├── data/                  # ktc-data (data-plane)
│   ├── compose.yaml        # основные сервисы (postgres/redis/minio/nats/migrate)
│   ├── compose.swarm.yaml  # overrides для Docker Swarm (опционально)
│   ├── .env.example        # секреты и образы (копировать в .env)
│   ├── Makefile            # make up / down / smoke / config / reset-data
│   ├── data/               # конфиги minio (buckets) и nats
│   ├── init/               # инициализация nats/sql, wait-for
│   ├── migrator/           # Dockerfile для tools/migrator
│   └── scripts/            # smoke.sh — проверка живости data-plane
├── app/                   # ktc-app (прикладной слой)
│   ├── compose.yaml        # auth..gw
│   ├── .env.example
│   └── config/*.toml       # конфиги сервисов для локального запуска
└── ai/                    # ktk-ai (ИИ-слой)
    ├── compose.yaml        # ai-service + ollama
    └── .env.example
└── sim/                   # ktk-sim (вычислительный слой)
    ├── compose.yaml        # sim-manager + sim-worker
    ├── .env.example
    └── config/sim-manager.toml
└── monitoring/            # ktk-mon (мониторинг)
    ├── compose.yaml        # prometheus + grafana + cadvisor
    ├── .env.example
    ├── prometheus/prometheus.yml
    └── grafana/
        ├── provisioning/   # datasource (prometheus) + dashboard provider
        └── dashboards/     # готовые дашборды (.json)
```

## Запуск

Порядок запуска по слоям (сначала data, потом app; ai можно в любое время):

```bash
# 1) data-plane (PostgreSQL, Redis, MinIO, NATS + миграции)
cd compose/data
cp .env.example .env
docker compose up -d --build

# 2) прикладной слой
cd ../app
cp .env.example .env
docker compose up -d --build

# 3) ИИ-слой (отдельный проект, не зависит от остальных)
cd ../ai
cp .env.example .env
docker compose up -d --build

# 4) Вычислительный слой (Simulation Engine: sim-manager + sim-worker)
cd ../sim
cp .env.example .env
docker compose up -d --build

# 5) Мониторинг (Prometheus + Grafana + cAdvisor) — после data (нужна сеть ktc-data)
cd ../monitoring
cp .env.example .env
docker compose up -d --build
```

Или через Makefile data-plane:

```bash
cd compose/data
make up
make smoke      # проверка живости postgres/redis/minio/nats
```

## Порты наружу (host)

| Сервис | Хост-порт | Переменная | Слой |
|--------|-----------|------------|------|
| assessment | 8081 | `HTTP_ASSESSMENT` | app |
| auth | 8082 | `HTTP_AUTH` | app |
| constructor | 8083 | `HTTP_CONSTRUCTOR` | app |
| scenario | 8084 | `HTTP_SCENARIO` | app |
| orchestrator | 8085 | `HTTP_ORCHESTRATOR` | app |
| snapshot | 8086 | `HTTP_SNAPSHOT` | app |
| report | 8087 | `HTTP_REPORT` | app |
| gw (вход) | 8088 | `HTTP_GW` | app |
| ai-service (REST) | 8080 | `AI_HTTP_HOST_PORT` | ai |
| ai-service (gRPC) | 50051 | `AI_GRPC_HOST_PORT` | ai |
| ollama | 11434 | `OLLAMA_HOST_PORT` | ai |
| sim-manager (REST) | 8091 | `SIM_MANAGER_HOST_PORT` | sim |
| sim-worker (REST) | 8092 | `SIM_WORKER_REST_HOST_PORT` | sim |
| sim-worker (gRPC) | 50062 | `SIM_WORKER_GRPC_HOST_PORT` | sim |
| postgres (PG-wire) | 5432 | `PICODATA_HOST_PORT` | data |
| redis (Radix) | 7379 | `RADIX_HOST_PORT` | data |
| minio S3 | 9000 | `MINIO_API_HOST_PORT` | data |
| minio console | 9001 | `MINIO_CONSOLE_HOST_PORT` | data |
| nats | 4222 | `NATS_CLIENT_HOST_PORT` | data |
| nats monitor | 8222 | `NATS_MONITOR_HOST_PORT` | data |
| prometheus | 9090 | `PROMETHEUS_HOST_PORT` | monitoring |
| grafana | 3000 | `GRAFANA_HOST_PORT` | monitoring |
| cadvisor | 18080 | `CADVISOR_HOST_PORT` | monitoring |

## Миграции

Миграции БД прогоняются слоем `data` (одиноразовая задача `migrate` на основе
`tools/migrator`) сразу после поднятия data-plane:

```bash
cd compose/data
docker compose run --rm migrate
```

## Замечания

- `.env` каждого слоя — локальные секреты, **не коммитятся** (см. `.gitignore`
  в корне и `compose/app/.gitignore`). Копируются из `.env.example`.
- Слой `ai` (ktk-ai) — отдельный compose-проект; при необходимости подключает
  GPU (см. закомментированный блок `deploy.resources` в `compose/ai/compose.yaml`).
- `compose/data/compose.swarm.yaml` — optional overrides для `docker stack deploy`
  (без Kubernetes); по умолчанию не используется.

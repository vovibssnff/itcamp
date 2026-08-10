# Слой ktc-sim: Simulation Engine (compose/sim)

Вычислительный слой платформы «Конструктор КТК» — Simulation Engine.

Состав:

- **sim-manager** — диспетчер (control-plane) инстансов Simulation Engine.
  Создаёт/удаляет и контролирует изолированные экземпляры движка под сессии
  (1 сессия = 1 инстанс). В dev-окружении использует **in-memory провайдер**
  (не поднимает реальные контейнеры через Docker API).
- **sim-worker** — Simulation Worker (Model API / математика ЭЛОУ-АВТ).
  Цифровой двойник техпроцесса, единственный источник тегов/алармов (FR-ISO-03).
  REST Model API для отладки и smoke, gRPC Model API — основной транспорт.

## Требуется

- data-plane: `compose/data/compose.yaml` (сеть `ktc-data`).
- Слой приложения (`compose/app`) — опционально, для сквозной интеграции.

## Запуск

```bash
cp .env.example .env
docker compose up -d --build
```

## Порты наружу (host)

Чтобы не конфликтовать с другими слоями (`compose/ai`, `compose/app`):

| Сервис | Контейнер | Host (по умолчанию) | Переменная |
|--------|-----------|---------------------|------------|
| sim-manager REST | 8080 | **8091** | `SIM_MANAGER_HOST_PORT` |
| sim-worker REST (Model API) | 8081 | **8092** | `SIM_WORKER_REST_HOST_PORT` |
| sim-worker gRPC (Model API) | 50061 | **50062** | `SIM_WORKER_GRPC_HOST_PORT` |

Внутри сети `ktc-data` сервисы достижимы по именам `sim-manager` и `sim-worker`.

## Проверка

```bash
curl http://localhost:8091/healthz        # sim-manager
curl http://localhost:8092/healthz        # sim-worker (REST Model API)
```

## Отношение к автотестам

sim-manager используется автотестами `autotests/tests/test_sim_manager.py`
(маркер `sim`, по умолчанию отключён). Базовый адрес задаётся переменной
`SIM_MANAGER_PORT` в `autotests/conftest.py` (по умолчанию `8091`).

Запуск автотестов sim-слоя:

```bash
cd autotests && SIM_MANAGER_PORT=8091 python3 -m pytest -m sim
```

## Примечания

- Конфиг sim-manager: `config/sim-manager.toml` (провайдер `memory` для dev).
- Для провайдера `docker` (реальные контейнеры движка) потребуется доступ к
  docker.sock хоста и параметры в конфиге — в dev не требуется.

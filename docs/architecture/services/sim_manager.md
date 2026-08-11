# Сервис: Simulation Manager — `sim-manager`

> Язык: Go | Слой: Вычислительный (control-plane) | HTTP: `:8091` | Сервис: `services/go/sim-manager`

## 1. Назначение

**Диспетчер (control-plane) Simulation Engine** — управляет жизненным циклом изолированных
инстансов `sim-worker` под сессии (1 сессия = 1 инстанс, ARCH-08). Сам **не** считает
модель; его задача — создавать/удалять инстансы движка, следить за квотой и статусом,
поддерживать их «живыми» (self-healing).

Реализация: **Go** + абстракция **RuntimeProvider** (управление средой инстанса). Контролируется через **Control API** (REST), потребляемый `orchestrator`.

> Разделение ролей: `sim-worker` — runtime (Model API, математика);
> `sim-manager` — control-plane (инстансы, провайдер среды, желаемое состояние).

## 2. Основные функции (Control API)

- Создание/удаление изолированных инстансов sim-worker под сессии.
- Контроль квоты (до 50 параллельных сессий) — отказ `QuotaExceeded` при переполнении.
- Отслеживание статуса инстансов: `created → pending → ready → failed`.
- Self-healing: пересоздание упавших инстансов (через RuntimeProvider).
- **Не считает модель** — это задача sim-worker.

## 3. RuntimeProvider

Абстракция управления инстансами даёт развязку «математика ↔ инфраструктура». Реализации выбираются конфигом:

| Провайдер | Режим | Назначение |
|---|---|---|
| `memory` | Тест/MVP | In-memory map session→endpoint, без реальных сред |
| `docker` | Прототип | реальные контейнеры sim-worker, публикация портов |
| `k8s` | Target (future) | CRD SimWorker + controller-runtime reconcile |

Один и тот же код control-plane работает во всех трёх; различается только провайдер
среды. Восстановление состояния после сбоя (restore) выполняет `orchestrator` через
Model API `set_state` — sim-manager отвечает лишь за живой инстанс и его endpoint.

## 4. Внутренняя структура

```
cmd/sim-manager/main.go       — точка входа
internal/
  config/                     — конфиг TOML (HTTP, provider)
  domain/                     — InstanceSpec, InstanceStatus, Phase, errors
  provider/                   — RuntimeProvider interface + реализации
  service/                    — manager_service (create/stop/status/list, quota)
  transport/http/handler/     — REST handlers (Control API)
  server/                     — http.Server, маршруты, shutdown
deploy/config.example.toml    — пример конфигурации
```

## 5. Конфигурация

Формат — **TOML** (`deploy/config.example.toml`). Путь через флаг `-config`.

| Секция | Назначение |
|---|---|
| `[http]` | адрес/таймауты HTTP-сервера |
| `[provider]` | выбор провайдера и параметры инстансов |

Параметры `[provider]`:

| Поле | По умолчанию | Назначение |
|---|---|---|
| `type` | `memory` | `memory` / `docker` / `k8s` |
| `docker_host` | `unix:///var/run/docker.sock` | endpoint среды (для docker-провайдера) |
| `worker_image` | `sim-worker:latest` | образ движка |
| `port_base` | `50060` | базовый порт инстансов |
| `max_instances` | `50` | квота параллельных сессий |
| `cpu_request` | `1000m` | запрос CPU на инстанс |
| `mem_request` | `512Mi` | запрос памяти на инстанс |

## 6. API / контракты (Control API)

| Метод | Путь | Назначение |
|---|---|---|
| POST | /sessions | Создать инстанс (декларативная заявка, идемпотентная) |
| DELETE | /sessions/{id} | Остановить/удалить инстанс |
| GET | /sessions/{id} | Статус инстанса (phase, endpoint) |
| GET | /sessions | Список инстансов + квота |

**Семантика создания:** `POST /sessions` — декларативная заявка (не блокируется до готовности);
готовность `orchestrator` опрашивает через `GET /sessions/{id}` (фазы). Ошибки:
`QuotaExceeded` (≥50), `AlreadyExists`, `InvalidSpec`, `InstanceFailed`. Повторная заявка
для той же сессии идемпотентна (возвращает текущий статус).

## 7. Данные / метрики

- Не хранит бизнес-данные и состояние модели (истина — в sim-worker; снапшоты — через snapshot).
- Метрики: число активных инстансов, остаток квоты, время создания/удаления, фазы, ошибки.

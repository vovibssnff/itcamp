# Simulation Manager — `sim-manager`

Диспетчер (control-plane) Simulation Engine: управляет жизненным циклом sim-worker инстансов.

## Назначение

- Создание/удаление изолированных инстансов sim-worker под сессии (1 сессия = 1 инстанс)
- Контроль квоты (до 50 параллельных сессий)
- Отслеживание статуса инстансов (created → pending → ready → failed)
- Self-healing: пересоздание упавших инстансов (через RuntimeProvider)
- **Не считает модель** — это задача sim-worker

## RuntimeProvider

Абстракция управления инстансами. Две реализации:

| Provider | Режим | Назначение |
|---|---|---|
| `InMemoryProvider` | Тест/MVP | In-memory map session→endpoint, без реальных контейнеров |
| `DockerProvider` | Прототип | Docker API: создание/остановка контейнеров sim-worker, публикация портов |
| `K8sProvider` | Target (future) | CRD SimWorker + controller-runtime reconcile |

## Структура

```
cmd/sim-manager/main.go       — точка входа
internal/
  config/                     — конфиг TOML (HTTP, provider)
  domain/                     — InstanceSpec, InstanceStatus, Phase, errors
  provider/                   — RuntimeProvider interface + InMemory + Docker
  service/                    — manager_service (create/stop/status/list, quota)
  transport/http/handler/     — REST handlers (Control API)
  server/                     — http.Server, маршруты, shutdown
deploy/                       — Dockerfile, config.example.toml
```

## Control API

| Метод | Путь | Назначение |
|---|---|---|
| POST | /sessions | Создать инстанс (декларативная заявка, идемпотентная) |
| DELETE | /sessions/{id} | Остановить/удалить инстанс |
| GET | /sessions/{id} | Статус инстанса (phase, endpoint) |
| GET | /sessions | Список инстансов + квота |

## Запуск

```bash
cp deploy/config.example.toml config.toml
# Для прототипа с Docker: provider.type = "docker"
# Для теста без Docker: provider.type = "memory"
go run ./cmd/sim-manager -config config.toml
```

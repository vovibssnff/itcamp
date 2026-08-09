# Orchestrator Service — `orchestrator`

«Дирижёр» сессий обучения: жизненный цикл, WS-телеметрия 1 Гц, автоинъекция неисправностей из сценария, чекпоинты.

## Назначение

- Создание/запуск/пауза/стоп сессий (FR-SESS-01/02)
- Управление модельным временем 0.1×–10× (FR-SESS-03)
- WS-телеметрия 1 Гц: оператор (RW) + наблюдение инструктора (RO) (FR-SESS-06)
- Автоинъекция неисправностей из сценария по триггерам (time/condition) (FR-FLT-01..06)
- Журналирование действий оператора (append-only) (FR-SESS-04)
- Чекпоинты и restore через snapshot (FR-SNAP-01/02)
- Координация sim, assessment, snapshot, ai, broker

## Структура

```
cmd/orchestrator/main.go       — точка входа
internal/
  config/                      — конфиг TOML (HTTP, DB, Redis, NATS, clients)
  domain/                      — Session, Telemetry, OperatorAction, AlarmEvent, FaultEvent
  repository/                  — Picodata (sessions, actions, alarms, faults)
  client/                      — интерфейсы SimClient/AssessmentClient/SnapshotClient + mock
  cache/                       — Radix (hot-state телеметрии)
  events/                      — NATS publisher (session.events, report.tasks, ai.tasks)
  service/                     — session_service, trigger_engine, ws_hub, ws_client
  transport/http/handler/      — REST + WS handlers
  server/                      — http.Server, маршруты, shutdown
api/openapi.yaml               — REST + WS контракт
deploy/                        — Dockerfile, config.example.toml
```

## Зависимости

| Зависимость | Тип | Протокол | Статус |
|---|---|---|---|
| Picodata | СУБД | PG-wire | ✅ через pgx |
| Radix | кэш | Redis | ✅ через go-redis |
| NATS | брокер | NATS | ✅ через nats.go |
| sim | gRPC | Model API | mock (ждём sim) |
| assessment | REST | events | mock (ждём assessment) |
| snapshot | gRPC | Save/Restore | mock (ждём snapshot) |
| constructor | REST | export | mock (готов) |
| scenario | REST | full scenario | mock (готов) |

## API

| Метод | Путь | Назначение |
|---|---|---|
| GET/POST | /sessions | Список / создание |
| GET | /sessions/{id} | Статус |
| POST | /sessions/{id}/start | Запуск |
| POST | /sessions/{id}/pause | Пауза |
| POST | /sessions/{id}/stop | Останов |
| PUT | /sessions/{id}/speed | Скорость 0.1×–10× |
| POST | /sessions/{id}/checkpoint | Снапшот |
| POST | /sessions/{id}/restore | Восстановление |
| POST | /sessions/{id}/actuator | Команда оператора |
| POST | /sessions/{id}/alarms/{alarm_id}/ack | Квитирование |
| GET (WS) | /ws/sessions/{id}/operator | Канал оператора (RW) |
| GET (WS) | /ws/sessions/{id}/observe | Канал наблюдения (RO) |

## Запуск

```bash
cp deploy/config.example.toml config.toml
go run ./cmd/orchestrator -config config.toml
```

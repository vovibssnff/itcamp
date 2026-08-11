# Сервис: Session Orchestrator — `orchestrator`

> Язык: Go | Слой: Прикладной | HTTP: `:8085` (за gw) | Сервис: `services/go/orchestrator`

## 1. Назначение

**«Дирижёр» сессии обучения** — «мозг» real-time контура. Управляет жизненным циклом
сессий: запуск/пауза/стоп, модельное время, рассылка телеметрии 1 Гц по WebSocket,
автоинъекция неисправностей из сценария, журналирование действий оператора, чекпоинты
через snapshot. Координирует Simulation Engine, Assessment, Snapshot, AI, Broker.

Реализация: **Go + REST/WebSocket** + Picodata + Radix (Redis) + NATS + клиенты gRPC/REST к sim/assessment/snapshot.

## 2. Основные функции

- Создание/запуск/пауза/стоп сессий (FR-SESS-01/02).
- Управление модельным временем `0.1×–10×` через sim (FR-SESS-03).
- WS-телеметрия 1 Гц: канал оператора (RW) + канал наблюдения инструктора (RO) (FR-SESS-06).
- Автоинъекция неисправностей из сценария по триггерам (time/condition) (FR-FLT-01..06).
- Журналирование действий оператора и событий (append-only в Picodata).
- Чекпоинты и restore через snapshot (FR-SNAP-01/02).
- Координация sim, assessment, snapshot, ai, broker.

## 3. Внутренняя структура

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
deploy/config.example.toml     — пример конфигурации
```

## 4. Конфигурация

Формат — **TOML** (`deploy/config.example.toml`). Путь через флаг `-config`.

| Секция | Назначение |
|---|---|
| `[http]` | адрес/таймауты HTTP-сервера |
| `[db]` | DSN и пул соединений Picodata |
| `[redis]` | адрес Radix/Redis, пароль, db (горячее состояние сессии) |
| `[nats]` | URL брокера NATS |
| `[clients]` | адреса constructor/scenario/sim/assessment/snapshot; `use_mock` — mock-клиенты (если сервис не готов) |
| `[telemetry]` | `hz` (частота тика, по умолч. 1.0), `tick_timeout` |

Зависимости (все через интерфейсы клиентов):

| Зависимость | Протокол |
|---|---|
| Picodata | PG-wire (pgx) |
| Radix | Redis (go-redis) |
| NATS | NATS (nats.go) |
| sim | gRPC Model API |
| assessment | REST (events) |
| snapshot | gRPC Save/Restore |
| constructor | REST export |
| scenario | REST full scenario |

## 5. API / контракты

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

## 6. Данные

- Picodata: сессии, журналы действий/алармов/неисправностей, чекпоинт-метаданные.
- Radix: горячее состояние сессии (телеметрия 1 Гц) для мгновенного доступа.

## 7. Метрики

- **tick-lag** (главная real-time-метрика), число активных сессий.
- WS-нагрузка, latency телеметрии, время restore/чека.
- Число подключённых инструкторов (read-only WS).

## 8. Деградация / отказоустойчивость

- Диспетчер stateless (состояние — в Picodata/Radix) → перезапуск безопасен.
- `clients.use_mock = true` — работа без готовых sim/assessment/snapshot (для разработки).
- Падение `ai` → деградация (rule-based), оценка не страдает.

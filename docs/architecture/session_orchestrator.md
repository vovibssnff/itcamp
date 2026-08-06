# Сервис: Session Orchestrator — `orchestrator`

> Слой: Прикладной | Namespace: `ktc-app` | Под: `orchestrator`
> Смежно: `Реестр_сервисов...`, `Сценарии_экзамен...`, `Архитектура_КТК_K8s.drawio`, `Simulation_Engine...k8s.md`

## 1. Назначение

**«Дирижёр» сессии обучения** — управляет жизненным циклом сессий и является «мозгом» real-time контура. Критичен к задержке (PERF-02), должен переживать отказы движка и ИИ (деградация).

## 2. Основные функции

- Создание/запуск/пауза/стоп сессий, управление режимом (Тренировка/Экзамен/Демо).
- Управление **модельным временем** (0.1×–10×) через `sim`.
- Рассылка **телеметрии 1 Гц** клиентам (WebSocket).
- **Чекпоинты** и координация save/restore (через snapshot).
- Координация Simulation Engine, Assessment, AI, Broker.
- Фиксация действий оператора и событий (журнал в Picodata).

## 3. Технологии

Python/FastAPI, WebSocket, асинхронные задачи.

## 4. Внутренняя структура

- Диспетчер сессий (map session_id → состояние).
- Цикл телеметрии: опрос `sim` (step) → push клиентам → кэш в Radix.
- Обработка команд клиентов (REST/WS).
- Планировщик чекпоинтов и взаимодействие с snapshot/ai/broker.

## 5. API / контракты

| Направление | Протокол | Методы |
|---|---|---|
| от `gw` | HTTPS/REST | `POST /session/start`, `/pause`, `/stop`, `GET /session/{id}`, `inject_fault`, `set_speed` |
| к клиенту | WebSocket | push телеметрии/статуса |
| к `sim` | Model API (gRPC/REST) | `step`, `get_state`, `set_state`, `inject_fault`, `set_speed` |
| к `assessment` | HTTPS/REST | события действия/аларма, запрос оценки |
| к `snapshot` | HTTPS/REST | save/restore |
| к `ai` | HTTPS/gRPC + mTLS | подсказки/разбор (не в экзамене) |
| к `broker` | AMQP/Kafka/NATS | асинхронные задачи/события |

## 6. Зависимости и протоколы

| Взаимодействует с | Тип | Протокол |
|---|---|---|
| API Gateway (`gw`) | микросервис | HTTPS/REST, WS |
| Simulation Engine (`sim`) | микросервис | Model API (gRPC/REST), mTLS |
| Assessment Engine (`assessment`) | микросервис | HTTPS/REST, mTLS |
| Snapshot Service (`snapshot`) | микросервис | HTTPS/REST, mTLS |
| AI Service (`ai`) | микросервис | HTTPS/gRPC + mTLS (fallback) |
| Брокер сообщений (`broker`) | инфраструктура | AMQP / Kafka / NATS |
| Picodata (`db`) | СУБД | SQL (PostgreSQL-wire) |
| Radix (`cache`) | кэш | Redis-протокол (RESP), TCP |
| Fluent Bit / promColl | observability | логи, `/metrics` (tick-lag) |

## 7. Данные

- Пикодата: сессии, журналы действий/алармов, чекпоинт-метаданные.
- Radix: горячее состояние сессии для мгновенного доступа.

## 8. Объекты Kubernetes (namespace `ktc-app`)

| Объект | Описание |
|---|---|
| Deployment `orchestrator` | N≥2 реплики (stateless диспетчер-мастер), HPA |
| Service `orchestrator` | ClusterIP |
| NetworkPolicy | egress к `sim`, `assessment`, `snapshot`, `ai`, `broker`, `db`, `cache` |
| Pod + sidecar `istio-proxy` | mTLS |

## 9. Метрики (в Astra Monitoring)

- **tick-lag** (главная метрика real-time), число активных сессий.
- WS-нагрузка, latency телеметрии, время restore/чека.

## 10. Отказоустойчивость / масштабирование

- Диспетчер stateless (состояние сессии — в db/Radix) → перезапуск безопасен.
- Падение `sim` → автоматический перезапуск + restore (≤15 с) без потери прогресса (≤3 мин).
- Падение `ai` → деградация (rule-based).
- HPA по числу сессий/нагрузке.

## 11. Открытые вопросы

1. «Владелец» финальной оценки — `orchestrator` или `assessment` (предлагаю: `assessment` считает, `orchestrator` финализирует).
2. Опрос `sim` через step по одному на тик vs батч — влияние на 10× скорость.
3. Размещение ленты телеметрии в Radix vs передача напрямую клиенту (буфер при обрыве).

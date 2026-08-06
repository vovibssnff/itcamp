# Сервис: Session Orchestrator — `orchestrator`

> Слой: Прикладной | Namespace: `ktc-app` | Под: `orchestrator`

## 1. Назначение

**«Дирижёр» сессии обучения** — управляет жизненным циклом сессий и является «мозгом» real-time контура. Критичен к задержке (PERF-02), должен переживать отказы движка и ИИ (деградация).

## 2. Основные функции

- Создание/запуск/пауза/стоп сессий, управление режимом (Тренировка/Экзамен).
- Получение конфигурации шаблона из `constructor` (init state) при старте сессии.
- Управление **модельным временем** (0.1×–10×) через `sim`.
- Рассылка **телеметрии 1 Гц** клиентам (WebSocket).
- **Автоматическая инъекция неисправностей** из сценария (по времени/условию) → вызов `sim.inject_fault`.
- **Чекпоинты** и координация save/restore (через snapshot).
- Координация Simulation Engine, Assessment, AI, Broker.
- Фиксация действий оператора и событий (журнал в Picodata).
- Подключение инструктора в режиме **read-only** (наблюдение телеметрии через WS).

## 3. Технологии

Python/FastAPI, WebSocket, асинхронные задачи.

## 4. Внутренняя структура

- Диспетчер сессий (map session_id → состояние).
- Цикл телеметрии: опрос `sim` (step) → push клиентам → кэш в Radix.
- **Планировщик событий сценария**: проверка триггеров (время/условие) → inject_fault в sim.
- Обработка команд клиентов (REST/WS).
- Планировщик чекпоинтов и взаимодействие с snapshot/ai/broker.

## 5. API / контракты

| Направление | Протокол | Методы |
|---|---|---|
| от `gw` | HTTPS/REST | `POST /session/start`, `/pause`, `/stop`, `GET /session/{id}`, `set_speed` |
| к клиенту (оператор) | WebSocket | push телеметрии/статуса (RW — команды оператора) |
| к клиенту (инструктор) | WebSocket | push телеметрии/статуса (read-only наблюдение) |
| к `sim` | gRPC (Model API) | `step`, `get_state`, `set_state`, `inject_fault`, `set_speed` |
| к `constructor` | HTTPS/REST | `GET /templates/{id}/export` (init state при старте) |
| к `assessment` | HTTPS/REST | события действия/аларма, запрос оценки |
| к `snapshot` | HTTPS/REST | save/restore |
| к `ai` | HTTPS/gRPC + mTLS | подсказки/разбор (не в экзамене) |
| к `broker` | NATS | асинхронные события сессии |

## 6. Зависимости и протоколы

| Взаимодействует с | Тип | Протокол |
|---|---|---|
| API Gateway (`gw`) | микросервис | HTTPS/REST, WS |
| Constructor Service (`constructor`) | микросервис | HTTPS/REST, mTLS |
| Simulation Engine (`sim`) | микросервис | gRPC (Model API), mTLS |
| Assessment Engine (`assessment`) | микросервис | HTTPS/REST, mTLS |
| Snapshot Service (`snapshot`) | микросервис | HTTPS/REST, mTLS |
| AI Service (`ai`) | микросервис | HTTPS/gRPC + mTLS (fallback) |
| Брокер сообщений (`broker`) | инфраструктура | NATS |
| Picodata (`db`) | СУБД | SQL (PostgreSQL-wire) |
| Radix (`cache`) | кэш | Redis-протокол (RESP), TCP |
| Fluent Bit / Пульт | observability | логи, `/metrics` (tick-lag) |

## 7. Данные

- Picodata: сессии, журналы действий/алармов, чекпоинт-метаданные.
- Radix: горячее состояние сессии для мгновенного доступа.

## 8. Объекты Kubernetes (namespace `ktc-app`)

| Объект | Описание |
|---|---|
| Deployment `orchestrator` | N≥2 реплики (stateless диспетчер), HPA |
| Service `orchestrator` | ClusterIP |
| NetworkPolicy | egress к `sim`, `constructor`, `assessment`, `snapshot`, `ai`, `broker`, `db`, `cache` |
| Pod + sidecar `istio-proxy` | mTLS |

## 9. Метрики (в Пульт + Графиня)

- **tick-lag** (главная метрика real-time), число активных сессий.
- WS-нагрузка, latency телеметрии, время restore/чека.
- Число подключённых инструкторов (read-only WS).

## 10. Отказоустойчивость / масштабирование

- Диспетчер stateless (состояние сессии — в db/Radix) → перезапуск безопасен.
- Падение `sim` → автоматический перезапуск + restore (≤15 с) без потери прогресса (≤3 мин).
- Падение `ai` → деградация (rule-based).
- HPA по числу сессий/нагрузке.

## 11. Открытые вопросы

1. «Владелец» финальной оценки — `orchestrator` или `assessment` (предлагаю: `assessment` считает, `orchestrator` финализирует).
2. Опрос `sim` через step по одному на тик vs батч — влияние на 10× скорость.
3. Размещение ленты телеметрии в Radix vs передача напрямую клиенту (буфер при обрыве).

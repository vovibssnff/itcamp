# Simulation Worker — `sim-worker`

Микросервис **цифрового двойника** установки **ЭЛОУ-АВТ** (runtime Simulation Engine).
Реализует **Model API** (`step` / `get_state` / `set_state` / `inject_fault` / `set_speed`) —
единственный источник истины о технологических тегах (FR-ISO-03), детерминированный
тик ≥1 Гц, изоляция на сессию (ARCH-08).

> **Не путать с `sim-manager`.**  
> Этот репозиторий = **`sim-worker`** (математика + Model API).  
> Жизненный цикл инстансов (create/stop подов, квота, reconcile) — отдельный сервис
> **`sim-manager`** с Control API (`create_session` / `stop_session` / `get_status`).  
> См. `sim_worker.md`, `sim_manager.md`, `sim_math_model.md`.

Потребитель Model API внутри кластера — только `orchestrator` (gRPC + mTLS).
Frontend, AI и Assessment к worker напрямую не ходят.

Python-пакет в дереве исходников исторически называется `sim_engine`
(`src/sim_engine/`); сервисная идентичность и Docker-имя — **`sim-worker`**.

## Что моделируется

Уровень L1 (упрощённая физика, точка расширения L1→L3 через тот же Model API):

| Блок | Оборудование | Ключевые теги |
| ---- | ------------ | ------------- |
| ЭЛОУ | Э-1/3/5, Е-15/16, Н-1 | LRCA 641/640/639, PRA 312/351, FRC 404–406 |
| Атмосфера | К-1, П-1/2/3, Е-1, Н-2/3/6 | PRSA 204, LRCA 602, TRC 2/3, FRC 408, TR 55-* |
| Вакуум / вторичка | К-2, К-3/1 | PRSA 213, LRCA 604/606, FRC 421/422 |
| Стабилизация | К-4 | PRCA 220/223, FR 415 |
| ГДМ (фрагмент) | К-12/4 | TR 1011, PR 2005, FQRC 3001 |
| Общезаводское | А-6 (воздух КИП) | PRA 700 |

Каталог неисправностей — **10 сценариев** из «Сценарии для КТК» (докс),
пороги сигнализаций и ПАЗ — из технологического регламента (разд. 3, 7.7, 9.1).

## Ключевые архитектурные решения

### ADR-СЕ-01. Ядро на stdlib + numpy только в интеграторе

Физика (`physics/`, `faults/`) не тянет SciPy/Pandas: тесты и headless-демо
работают на Python 3.10+ с одним `numpy` (дробление шага при `set_speed` до 10×).
Транспорт (FastAPI/gRPC) — отдельный слой.

### ADR-СЕ-02. Неисправность = возмущение контура, а не подмена модели

Каждый контролируемый параметр — ПИ-контур (`ControlLoop`) с инерцией 1-го
порядка. Неисправность либо:

- суммируется в `disturbance` (контур *может* отработать, но за время
  переходного процесса PV пересечёт порог, если не вмешаться), либо
- режет располагаемую мощность (`out_max` / `supply_ok`) — контур сам не
  восстановится, нужны соседние «assist»-точки (АВЗ, оборотная вода, орошение).

Это ровно механика докс-сценариев: «ранние признаки» → «немедленные действия»
→ «если ухудшается — ПАЗ».

### ADR-СЕ-03. Числа в JSON, топология в коде

Коэффициенты контуров, печей, насосов — в `data/template_atm_demo.json`.
Связи assist→контур и эффекты ПАЗ — в коде (`network.COUPLINGS`,
`interlocks.INTERLOCK_EFFECTS`). Универсальный интерпретатор графа Constructor
Service сюда пока не тащим (целевое требование ARCH-07 / `sim_math_model.md` —
точка расширения; прототип знает физику демо-шаблона ЭЛОУ-АВТ).

### ADR-СЕ-04. Детерминизм обязателен

Один и тот же `seed` + та же последовательность команд/неисправностей дают
байт-в-байт одинаковые теги. Нужно для HMAC-протокола экзамена и restore
снапшота (Snapshot Service). Закреплено тестом `test_determinism_same_seed`.

### ADR-СЕ-05. Совместимость тегов с ai-service

`template_id` / словарь тегов согласованы с `ai/data/tags_demo.json`, чтобы
журнал `OperatorAction` / `AlarmEvent` с worker уходил в `ReviewSession` без
маппинга. Добавлены теги К-4 и PRA 700 под докс-сценарии 6.1 / 7.1.

## Быстрый старт

```bash
# 1. Тесты ядра (нужен numpy; fastapi — для test_rest)
pip install -r requirements.txt
make test

# 2. Headless-демо сценария 4.1 (рост давления в К-1)
make demo
PYTHONPATH=src python3 scripts/demo.py --stabilize

# 3. REST на :8081 (Model API; в кластере основной транспорт — gRPC :50061)
make run
curl -s localhost:8081/readyz
curl -s -X POST localhost:8081/v1/sessions -H 'Content-Type: application/json' \
  -d '{"session_id":"s1","seed":42}'
```

В target-контуре инстанс worker поднимает `sim-manager`; локально для разработки
сессию создаёт сам worker через `POST /v1/sessions` (удобный smoke без manager).

## Структура

```
src/sim_engine/          # Python-пакет worker (имя модуля)
├── physics/             # математическая модель L1 (см. sim_math_model.md)
│   ├── units.py         ControlLoop, FurnaceLoop, Pump, InstrumentAirBuffer
│   ├── network.py       топология + связи assist → disturbance
│   └── interlocks.py    сигнализации H/HH/L/LL и эффекты ПАЗ
├── faults/              каталог и инжектор неисправностей
├── engine/              Model API, сессии, интегратор
├── domain/              dataclasses (совместимы по форме с ai_service)
└── api/                 REST (отладка) и gRPC Model API
data/
├── template_atm_demo.json   теги, уставки, контуры, печи, насосы
└── faults_catalog.json      10 неисправностей из докс-сценариев
```

## Model API

| Метод | REST (dev) | gRPC (target) |
| ----- | ---------- | ------------- |
| Создать сессию в процессе* | `POST /v1/sessions` | `CreateSession` |
| Тик | `POST /v1/sessions/{id}/step` | `Step` |
| Состояние | `GET/PUT .../state` | `GetState` / `SetState` |
| Неисправность | `POST .../faults` | `InjectFault` |
| Скорость 0.1…10× | `POST .../speed` | `SetSpeed` |
| Команда оператора | `POST .../command` | `Command` |
| Каталог неисправностей | `GET /v1/faults` | `ListFaults` |

\*В target жизненный цикл инстанса — у `sim-manager` (Control API); Model API
управляет только моделью внутри уже поднятого worker.

Proto: `proto/ktk/sim/v1/model_api.proto`. Порты: REST **8081**, gRPC **50061**
(отличаются от ai-service 8080/50051).

## Соответствие сценариям

| Докс | fault_id | Что проверяет модель |
| ---- | -------- | -------------------- |
| 1.1 | `FLT-ELOU-INTERFACE-LOW` | Уровень раздела фаз < 3500 мм → снятие напряжения ИПМ |
| 1.2 | `FLT-ELOU-PRESSURE-HIGH` | Рост PRA 312 / Е-15 |
| 2.1 | `FLT-FEED-FLOW-LOW` | Падение расхода сырья при работающих печах → рост COT |
| 3.1 | `FLT-P3-COT-HIGH` | TR 55-9 → 340 °C |
| 4.1 | `FLT-K1-PRESSURE-HIGH` | PRSA 204 → 4.5 (H) → 4.8 (ПАЗ: отсечка топлива) |
| 4.2 | `FLT-K1-LEVEL-LOW` | LRCA 602 ↓ |
| 5.1 | `FLT-K2-VACUUM-LOSS` | PRSA 213 → 1.0 / 1.5 |
| 5.2 | `FLT-K31-LEVEL-LOW` | LRCA 606 < 15 % → trip Н-14 |
| 6.1 | `FLT-K4-PRESSURE-HIGH` | PRCA 220 |
| 7.1 | `FLT-IA-PRESSURE-LOW` | PRA 700, часовой запас А-6 → fail-safe |

## Связь с другими сервисами

```
orchestrator ──gRPC Control API──► sim-manager ──ensureInstance──► sim-worker (этот сервис)
     │                                                              ▲
     └────────────── gRPC Model API (step/get_state/…) ─────────────┘

orchestrator ──NATS ai.tasks──► ai-service
orchestrator ──события─────────► assessment / snapshot
```

Падение AI не останавливает worker (NFR-REL-03). Падение инстанса —
`sim-manager` пересоздаёт runtime, `orchestrator` делает `set_state` из
Snapshot Service (≤15 с); другие сессии не страдают.

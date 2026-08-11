# Сервис: Simulation Worker — `sim-worker`

> Язык: Python (пакет `sim_engine`) | Слой: Вычислительный (runtime) | Сервис: `services/python/sim-engine`
> REST: `:8092` (внутр. `8081`) | gRPC Model API: `:50062` (внутр. `50061`)

## 1. Назначение

**Цифровой двойник техпроцесса ЭЛОУ-АВТ** — единственный источник истины о технологическом
состоянии (FR-ISO-03). Детерминированный тик ≥1 Гц, изоляция на сессию. Реализует
**Model API**: `step` / `get_state` / `set_state` / `inject_fault` / `set_speed` / `command`.

> **Не путать с `sim-manager`.** Данный сервис = `sim-worker` (математика + Model API).
> Жизненный цикл инстансов (создание/стоп, квота) — отдельный сервис `sim-manager`
> с Control API (создание сессии). Потребитель Model API — только `orchestrator`.

## 2. Что моделируется

Уровень L1 (упрощённая физика, точка расширения L1→L3 через тот же Model API):

| Блок | Оборудование | Ключевые теги |
|---|---|---|
| ЭЛОУ | Э-1/3/5, Е-15/16, Н-1 | LRCA 641/640/639, PRA 312/351, FRC 404–406 |
| Атмосфера | К-1, П-1/2/3, Е-1, Н-2/3/6 | PRSA 204, LRCA 602, TRC 2/3, FRC 408, TR 55-* |
| Вакуум / вторичка | К-2, К-3/1 | PRSA 213, LRCA 604/606, FRC 421/422 |
| Стабилизация | К-4 | PRCA 220/223, FR 415 |
| ГДМ (фрагмент) | К-12/4 | TR 1011, PR 2005, FQRC 3001 |
| Общезаводское | А-6 (воздух КИП) | PRA 700 |

Каталог неисправностей — 10 сценариев из «Сценарии для КТК» (пороги сигнализаций и ПАЗ —
из тех. регламента). См. `sim_math_model.md` для деталей математики.

## 3. Ключевые решения

- **Ядро на stdlib + numpy** (physica/faults не тянут SciPy/Pandas) — делит шаг при `set_speed` до 10× (ADR-СЕ-01).
- **Неисправность = возмущение контура**, а не подмена модели (ADR-СЕ-02): суммируется в disturbance (контур может отработать) или режет мощность (нужны соседние assist-точки).
- **Числа в JSON, топология в коде** (ADR-СЕ-03): коэффициенты — в `data/template_atm_demo.json`, связи — в коде (`network.COUPLINGS`, `interlocks.INTERLOCK_EFFECTS`).
- **Детерминизм обязателен** (ADR-СЕ-04): один seed + та же последовательность → одинаковые теги (для HMAC-протокола и restore).
- **Совместимость тегов с ai-service** (ADR-СЕ-05): словарь тегов согласован с `ai/data/tags_demo.json`.

## 4. Структура

```
src/sim_engine/
├── physics/      математическая модель L1 (ControlLoop, FurnaceLoop, Pump, network, interlocks)
├── faults/       каталог и инжектор неисправностей
├── engine/       Model API, сессии, интегратор
├── domain/       dataclasses (совместимы по форме с ai_service)
└── api/          REST (отладка) и gRPC Model API
data/
├── template_atm_demo.json   теги, уставки, контуры, печи, насосы
└── faults_catalog.json      10 неисправностей из докс-сценариев
proto/ktk/sim/v1/model_api.proto
```

## 5. Конфигурация

Конфигурируется в основном **данными** (модель не захардкожена в коде):

| Файл / Переменная | Назначение |
|---|---|
| `data/template_atm_demo.json` | теги, уставки, контуры, печи, насосы демо-шаблона |
| `data/faults_catalog.json` | каталог неисправностей (10 шт., `FLT-*`) |
| `KTC_SIM_REST_PORT` | порт REST Model API (внутр. `8081`) |
| `KTC_SIM_GRPC_PORT` | порт gRPC Model API (внутр. `50061`) |
| seed (при создании сессии) | seed ГПСЧ → детерминированная траектория |

## 6. Model API

| Метод | REST (dev) | gRPC (target) |
|---|---|---|
| Создать сессию в процессе* | `POST /v1/sessions` | `CreateSession` |
| Тик | `POST /v1/sessions/{id}/step` | `Step` |
| Состояние | `GET/PUT .../state` | `GetState` / `SetState` |
| Неисправность | `POST .../faults` | `InjectFault` |
| Скорость 0.1…10× | `POST .../speed` | `SetSpeed` |
| Команда оператора | `POST .../command` | `Command` |
| Каталог неисправностей | `GET /v1/faults` | `ListFaults` |

\*В целевом контуре жизненный цикл инстанса — у `sim-manager` (Control API); Model API
управляет только моделью внутри уже поднятого worker. Локально для smoke-теста сессию
создаёт сам worker через `POST /v1/sessions`.

Proto: `proto/ktk/sim/v1/model_api.proto`.

## 7. Метрики

- **tick-lag** (главная real-time-метрика), число активных сессий, время step/get_state/set_state, CPU/RAM, число под-шагов на тик.

# Сервис: Constructor Service — `constructor`

> Язык: Go | Слой: Прикладной | HTTP: `:8083` (за gw) | Сервис: `services/go/constructor`

## 1. Назначение

**Ядро конструктора КТК** — библиотека компонентов и шаблонов установок. Хранит типы
оборудования (параметры, порты), графы собранных установок и layout мнемосхем;
выполняет валидацию топологии и экспорт конфигурации для Simulation Engine.

Реализация: **Go + REST** + Picodata (pgx + JSONB) + S3 (MinIO) для иконок компонентов.

## 2. Основные функции

- **CRUD библиотеки компонентов**: типы оборудования (насос, колонна, печь, электродегидратор, реактор и т.д.) с портами, параметрами, иконками, категориями (ЭЛОУ / Атмосфера / ГДМ / Общие).
- **CRUD шаблонов установок**: граф (узлы + рёбра + параметры экземпляров + layout мнемосхемы).
- **Валидация графа**: типы портов (жидкость↔жидкость, сигнал↔сигнал), связность, источник/сток, обязательные порты.
- **Копирование шаблонов** (deep clone с новым ID).
- **Экспорт**: генерация init-state для sim (`sim_state.json`).
- **Поиск и фильтрация** каталога по категориям/тегам.
- **Seed библиотеки** при старте (24 типа из тех. документации ЭЛОУ-АВТ).

## 3. Внутренняя структура

```
cmd/constructor/main.go       — точка входа
internal/
  config/                     — конфиг TOML
  domain/                     — ComponentType, Template, Graph, Validation
  repository/                 — Picodata (pgx + JSONB)
  service/                    — component, template, validator, exporter
  transport/http/handler/     — REST handlers
  server/                     — http.Server, маршруты, shutdown
seeds/                        — библиотека КТС (24 типа из документации)
api/openapi.yaml              — REST-контракт
deploy/config.example.toml    — пример конфигурации
```

## 4. Конфигурация

Формат — **TOML** (`deploy/config.example.toml`). Путь через флаг `-config`.

| Секция | Назначение |
|---|---|
| `[http]` | адрес/таймауты HTTP-сервера |
| `[db]` | DSN и пул соединений Picodata |
| `[s3]` | endpoint MinIO, bucket `component-icons`, credentials, `use_ssl` |
| `[seed]` | `enabled` (загрузка библиотеки из `seeds/` при старте) |

## 5. API / контракты

| Метод | Путь | Назначение |
|---|---|---|
| GET | /components | Каталог компонентов (фильтр по категории, поиск) |
| POST | /components | Создать тип |
| GET/PUT/DELETE | /components/{id} | CRUD типа |
| GET | /templates | Каталог шаблонов |
| POST | /templates | Создать шаблон |
| GET/PUT/DELETE | /templates/{id} | CRUD шаблона |
| POST | /templates/{id}/copy | Deep clone |
| POST | /templates/{id}/validate | Валидация графа |
| GET | /templates/{id}/export | Init-state для sim |

## 6. Данные

- Picodata:
  - `component_types` — id, name, category, description, ports (JSONB), parameters (JSONB), icon_s3_key;
  - `installation_templates` — id, name, author, graph (JSONB), layout (JSONB).
- S3 (MinIO): bucket `component-icons` — SVG/PNG иконки типов.

## 7. Seed библиотеки

При `seed.enabled = true` загружаются 24 типа из `seeds/`:
- **Общие (11):** насос, теплообменник, клапан, задвижка, ПИД, КИП, ёмкость, смеситель, ППК, источник, сток;
- **ЭЛОУ (4):** электродегидратор, ИПМ, трансформатор, дозатор;
- **Атмосфера (7):** колонна, стриппинг, печь, АВО, конденсатор, газосепаратор, стабилизация;
- **ГДМ (4):** реактор, отпарная, каплеотбойник, пароперегреватель.

Параметры заполнены из тех. документации (насосное_оборудование.md, теплообменное_и_холодильное.md, краткая_характеристика.md).

## 8. Метрики

- Число компонентов/шаблонов в библиотеке, CRUD/сек, латентность, ошибки валидации, время экспорта.

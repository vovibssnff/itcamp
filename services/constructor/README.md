# Constructor Service — `constructor`

Библиотека компонентов КТС, CRUD шаблонов установок, валидация графа, экспорт init-state.

## Назначение

- CRUD библиотеки компонентов (24 типа из тех. документации ЭЛОУ-АВТ)
- CRUD шаблонов установок (граф + layout мнемосхемы)
- Валидация графа (типы портов, связность, обязательные порты, источник/сток)
- Экспорт init-state для `sim` (sim_state.json)
- Seed библиотеки при старте (24 типа: Общие, ЭЛОУ, Атмосфера, ГДМ)

## Структура

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
deploy/                       — Dockerfile, config.example.toml
```

## API

См. `api/openapi.yaml`. Основные эндпоинты:

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

## Запуск

```bash
cp deploy/config.example.toml config.toml
go run ./cmd/constructor -config config.toml
```

## Seed библиотеки

При `seed.enabled = true` сервис загружает 24 типа компонентов из `seeds/`:
- **Общие (11):** насос, теплообменник, клапан, задвижка, ПИД, КИП, ёмкость, смеситель, ППК, источник, сток
- **ЭЛОУ (4):** электродегидратор, ИПМ, трансформатор, дозатор
- **Атмосфера (7):** колонна, стриппинг, печь, АВО, конденсатор, газосепаратор, стабилизация
- **ГДМ (4):** реактор, отпарная, каплеотбойник, пароперегреватель

Параметры заполнены из тех. документации (насосное_оборудование.md, теплообменное_и_холодильное.md, краткая_характеристика.md).

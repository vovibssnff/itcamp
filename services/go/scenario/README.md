# Scenario Service — `scenario`

CRUD сценариев тренировки/экзамена, каталог неисправностей, триггеры.

## Назначение

- CRUD сценариев (training/exam) с неисправностями, триггерами, эталонными действиями, критериями
- Каталог типовых неисправностей (привязан к типам компонентов)
- Триггеры: по модельному времени (time) или по условию (condition: tag ≥ порог)
- Seed: 10 сценариев + 10 неисправностей из документации ЭЛОУ-АВТ
- Случайная выдача экзаменационного сценария (для orchestrator)

## Структура

```
cmd/scenario/main.go          — точка входа
internal/
  config/                     — конфиг TOML
  domain/                     — Scenario, Fault, Trigger, ReferenceAction, Criteria
  repository/                 — Picodata (pgx + JSONB)
  service/                    — scenario_service, fault_service, trigger_validator
  transport/http/handler/     — REST handlers
  server/                     — http.Server, маршруты, shutdown
seeds/                        — 10 сценариев + каталог неисправностей
api/openapi.yaml              — REST-контракт
deploy/                       — Dockerfile, config.example.toml
```

## API

| Метод | Путь | Назначение |
|---|---|---|
| GET | /scenarios | Каталог (фильтр: template_id, type, q) |
| POST | /scenarios | Создать сценарий |
| GET/PUT/DELETE | /scenarios/{id} | CRUD |
| POST | /scenarios/{id}/clone | Клон (опц. на другой template_id) |
| GET | /scenarios/{id}/full | Полный сценарий (для orchestrator) |
| GET | /scenarios/exam?template_id= | Случайный экзаменационный |
| GET | /faults | Каталог неисправностей |
| GET | /faults/{fault_id} | Карточка неисправности |

## Запуск

```bash
cp deploy/config.example.toml config.toml
go run ./cmd/scenario -config config.toml
```

## Seed

При `seed.enabled = true` загружаются:
- **10 неисправностей** (`FLT-*`, совпадают с sim-engine `faults_catalog.json`)
- **10 сценариев** из документа «Сценарии для КТК» (ЭЛОУ, печи, К-1, К-2, К-3/1, К-4, воздух КИП)

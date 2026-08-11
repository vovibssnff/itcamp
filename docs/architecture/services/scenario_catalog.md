# Сервис: Scenario / Catalog Service — `scenario`

> Язык: Go | Слой: Прикладной | HTTP: `:8084` (за gw) | Сервис: `services/go/scenario`

## 1. Назначение

**Библиотека и каталог** учебных сценариев (тренировка/экзамен) и каталог неисправностей.
Сценарий привязан к шаблону установки (из `constructor`) и содержит неисправности с
триггерами (по модельному времени / по условию на тег) и эталонные действия для оценки.

Реализация: **Go + REST** + Picodata (pgx + JSONB).

## 2. Основные функции

- CRUD сценариев (training/exam): создание, редактирование, удаление, клонирование.
- Каталог типовых неисправностей (привязан к типам компонентов).
- Триггеры неисправностей: по модельному времени (`time`) или по условию (`condition`: tag ≥ порог).
- Эталонные действия и критерии оценки (для `assessment`).
- Seed: 10 сценариев + 10 неисправностей из документации ЭЛОУ-АВТ.
- Случайная выдача экзаменационного сценария (`GET /scenarios/exam`) для `orchestrator`.

## 3. Внутренняя структура

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
deploy/config.example.toml    — пример конфигурации
```

## 4. Конфигурация

Формат — **TOML** (`deploy/config.example.toml`). Путь через флаг `-config`.

| Секция | Назначение |
|---|---|
| `[http]` | адрес/таймауты HTTP-сервера |
| `[db]` | DSN и пул соединений Picodata |
| `[seed]` | `enabled` (загрузка сценариев и каталога неисправностей из `seeds/`) |

## 5. API / контракты

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

## 6. Данные

- Picodata: метаданные сценариев, каталог неисправностей, связи с тегами/шаблонами, эталоны.
- S3/бинарные артефакты сценариев (если есть).

## 7. Seed

При `seed.enabled = true` загружаются:
- **10 неисправностей** (`FLT-*`, совпадают с sim-engine `faults_catalog.json`);
- **10 сценариев** из документа «Сценарии для КТК» (ЭЛОУ, печи, К-1, К-2, К-3/1, К-4, воздух КИП).

## 8. Метрики

- Число сценариев, операции CRUD/клонирования, время поиска/выдачи, ошибки целостности.

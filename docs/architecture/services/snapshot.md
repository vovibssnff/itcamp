# Сервис: Snapshot Service — `snapshot`

> Язык: Go | Слой: Прикладной | HTTP: `:8086` (за gw) | Сервис: `services/go/snapshot`

## 1. Назначение

**«Сохранение игры»** — сохранение и восстановление полного состояния сессии:
payload в объектное хранилище (S3/MinIO) + метаданные в Picodata + контроль целостности
(SHA-256). Используется для чекпоинтов, restore после сбоя и presets стартовых состояний.

Реализация: **Go + REST** + MinIO/S3 + Picodata.

## 2. Основные функции

- **save**: полное состояние (модель, регуляторы, алармы, оценка, модельное время, ГПСЧ) → gzip → MinIO + метаданные в Picodata + SHA-256 (FR-SNAP-01/04).
- **restore**: загрузка из MinIO, проверка SHA-256, возврат состояния для `sim.set_state` (FR-SNAP-02).
- **Presets**: immutable стартовые состояния (FR-SNAP-03).
- Удаление: нельзя удалить preset (FR-SNAP-03).
- Ёмкость: ≥10 000 состояний (NFR-SCL-03).

## 3. Внутренняя структура

```
cmd/snapshot/main.go          — точка входа
internal/
  config/                     — конфиг TOML (HTTP, DB, S3)
  domain/                     — SnapshotMeta, SaveRequest/Response, RestoreRequest/Response
  repository/                 — Picodata (метаданные снапшотов)
  storage/                    — MinIO/S3 (gzip + SHA-256)
  service/                    — snapshot_service (save, restore, validate, delete)
  transport/http/handler/     — REST handlers
  server/                     — http.Server, маршруты, shutdown
api/openapi.yaml              — REST-контракт
deploy/config.example.toml    — пример конфигурации
```

## 4. Конфигурация

Формат — **TOML** (`deploy/config.example.toml`). Путь через флаг `-config`.

| Секция | Назначение |
|---|---|
| `[http]` | адрес/таймауты HTTP-сервера |
| `[db]` | DSN и пул соединений Picodata |
| `[s3]` | endpoint MinIO, bucket `snapshots`, credentials (access/secret), `use_ssl`, `region` |

## 5. API / контракты

| Метод | Путь | Назначение |
|---|---|---|
| POST | /snapshots/save | Сохранить состояние (payload → S3, meta → DB) |
| POST | /snapshots/restore | Восстановить (S3 → проверка SHA-256) |
| GET | /snapshots | Список (фильтр: session_id, is_preset) |
| GET | /snapshots/{id} | Метаданные |
| DELETE | /snapshots/{id} | Удалить (не preset) |

## 6. Данные

- Picodata: метаданные снапшота (id, session_id, время, автор, schema_version, SHA-256, storage_key).
- S3 (MinIO): сжатый immutable payload (gzip). Целостность — SHA-256.
- Ёмкость: ≥10 000 сохранённых состояний (SCL-02).

## 7. Метрики

- Время save/restore (PERF-03 ≤15 с), число операций, размер payload, ошибки целостности.

## 8. Отказоустойчивость / целостность

- Barrier на границе тика — согласованность состояния (координация с `orchestrator`).
- Restore валидируется (SHA-256) перед применением; при сбое — фолбэк на последний валидный.

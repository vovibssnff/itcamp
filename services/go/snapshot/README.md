# Snapshot Service — `snapshot`

«Сохранение игры»: save/restore состояния сессии (payload в MinIO + метаданные в Picodata + SHA-256).

## Назначение

- Save: полное состояние (модель, регуляторы, алармы, оценка, модельное время, ГПСЧ) → gzip → MinIO + метаданные в Picodata + SHA-256 (FR-SNAP-01/04)
- Restore: загрузка из MinIO, проверка SHA-256, возврат для sim.SetState (FR-SNAP-02)
- Presets: immutable стартовые состояния (FR-SNAP-03)
- Удаление: нельзя удалить preset (FR-SNAP-03)
- Ёмкость: ≥10 000 состояний (NFR-SCL-03)

## Структура

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
deploy/                       — Dockerfile, config.example.toml
```

## API

| Метод | Путь | Назначение |
|---|---|---|
| POST | /snapshots/save | Сохранить состояние (payload → S3, meta → DB) |
| POST | /snapshots/restore | Восстановить (S3 → проверка SHA-256) |
| GET | /snapshots | Список (фильтр: session_id, is_preset) |
| GET | /snapshots/{id} | Метаданные |
| DELETE | /snapshots/{id} | Удалить (не preset) |

## Запуск

```bash
cp deploy/config.example.toml config.toml
go run ./cmd/snapshot -config config.toml
```

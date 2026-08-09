# Report Service — `report`

«Секретарь»: генерация PDF-отчётов по сессии/экзамену. Асинхронно через NATS.

## Назначение

- Приём задач через NATS `report.tasks` (не блокирует сессию, FR-ASSESS-07)
- Сбор данных сессии из Picodata (оценка, действия, алармы, неисправности)
- Генерация PDF (gofpdf) с полным отчётом
- Хранение PDF в MinIO, метаданных + canonical_json в Picodata
- REST API: запрос отчёта, статус, список, download
- Статусы: queued → processing → ready / failed

## Структура

```
cmd/report/main.go            — точка входа + NATS consumer
internal/
  config/                     — конфиг TOML (HTTP, DB, NATS)
  domain/                     — Report, ReportStatus, SessionData, ReportTask
  repository/                 — Picodata (reports + чтение actions/alarms/faults/score)
  service/                    — report_service + GeneratePDF (gofpdf)
  transport/http/handler/     — REST handlers
  server/                     — http.Server, маршруты, shutdown
api/openapi.yaml              — REST-контракт
deploy/                       — Dockerfile, config.example.toml
```

## API

| Метод | Путь | Назначение |
|---|---|---|
| POST | /reports | Запросить отчёт (→ 202 Accepted, публикует в NATS) |
| GET | /reports?session_id= | Список отчётов сессии |
| GET | /reports/{id} | Статус / метаданные |
| GET | /reports/{id}/download | Скачать PDF (302 на S3) |

## NATS

Consumer подписан на `report.tasks` (queue group `report-workers`). Orchestrator публикует задачи через `events.PublishReportTask`.

## Запуск

```bash
cp deploy/config.example.toml config.toml
go run ./cmd/report -config config.toml
```

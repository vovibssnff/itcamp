# Сервис: Reporting — `report`

> Язык: Go | Слой: Прикладной | HTTP: `:8087` (за gw) | Сервис: `services/go/report`

## 1. Назначение

**«Секретарь»** — генерация отчётных PDF-документов по сессии/экзамену. Тяжёлая
асинхронная задача выполняется в фоне (через NATS), не блокируя real-time контур
(INT-03).

Реализация: **Go + REST + NATS consumer + gofpdf** + MinIO/S3 + Picodata.

## 2. Основные функции

- Приём задач через NATS `report.tasks` (не блокирует сессию, FR-ASSESS-07).
- Сбор данных сессии из Picodata (оценка, действия, алармы, неисправности).
- Генерация PDF (gofpdf) с полным отчётом — **кириллица** (встроенный шрифт Arial).
- Хранение PDF в MinIO, метаданных + canonical_json в Picodata.
- REST API: запрос отчёта, статус, список, download.
- Статусы: `queued → processing → ready / failed`.
- Расшифровка внутренних кодов (FRCA/FLT-*) в человекочитаемые описания в отчёте.

## 3. Внутренняя структура

```
cmd/report/main.go            — точка входа + NATS consumer
internal/
  config/                     — конфиг TOML (HTTP, DB, NATS)
  domain/                     — Report, ReportStatus, SessionData, ReportTask
  repository/                 — Picodata (reports + чтение actions/alarms/faults/score)
  service/                    — report_service + GeneratePDF (gofpdf + шрифт Arial)
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
| `[nats]` | URL брокера, subject `report.tasks`, `queue_group` (группа потребителей) |

## 5. API / контракты

| Метод | Путь | Назначение |
|---|---|---|
| POST | /reports | Запросить отчёт (→ 202 Accepted, публикует в NATS) |
| GET | /reports?session_id= | Список отчётов сессии |
| GET | /reports/{id} | Статус / метаданные |
| GET | /reports/{id}/download | Скачать PDF (302 → S3) |

## 6. NATS

Consumer подписан на `report.tasks` (queue group `report-workers`). Задачи публикует
`orchestrator` через `events.PublishReportTask`.

## 7. Данные

- Picodata: метаданные отчёта/протокола, канонический JSON, статус.
- S3 (MinIO): PDF-файлы.

## 8. Метрики

- Время генерации PDF (PERF-05 ≤20 с), длина очереди, успешность, ошибки.

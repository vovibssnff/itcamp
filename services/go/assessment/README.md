# Assessment Service — `assessment`

«Экзаменатор»: сравнение действий оператора с эталоном, штрафы, критические ошибки, вердикт.

## Назначение

- Приём событий (action/alarm) от orchestrator (FR-ASSESS-01/02)
- Сравнение действий с эталоном сценария (reference_actions)
- Штрафы: просрочка (LATE_STEP), пропуск (MISSED_STEP), запрещённое действие (FR-ASSESS-03)
- Критические ошибки → автоматический fail (FR-ASSESS-04)
- Время реакции на аларм (FR-ASSESS-01)
- Финализация вердикта (pass/fail) по порогу (FR-ASSESS-05)
- Переопределение оценки инструктором с комментарием (FR-ASSESS-05, UI-15)
- Replay: действия, алармы, неисправности (FR-ASSESS-06)
- Rule-based (работает без ИИ, NFR-REL-03)

## Структура

```
cmd/assessment/main.go        — точка входа
internal/
  config/                     — конфиг TOML
  domain/                     — Score, Penalty, CriticalError, ReactionTime, Override, Criteria
  repository/                 — Picodata (assessments, overrides, replay)
  client/                     — ScenarioClient (HTTP + mock)
  service/                    — assessment_service, scoring_engine
  transport/http/handler/     — REST handlers
  server/                     — http.Server, маршруты, shutdown
api/openapi.yaml              — REST-контракт
deploy/                       — Dockerfile, config.example.toml
```

## API

| Метод | Путь | Назначение |
|---|---|---|
| POST | /assessment/event?scenario_id= | Событие от orchestrator (action/alarm) |
| GET | /assessment/session/{id}/score | Текущая оценка |
| POST | /assessment/session/{id}/result | Финализировать вердикт |
| POST | /assessment/override | Переопределить оценку (instructor) |
| GET | /assessment/session/{id}/replay | Данные для replay |

## Запуск

```bash
cp deploy/config.example.toml config.toml
go run ./cmd/assessment -config config.toml
```

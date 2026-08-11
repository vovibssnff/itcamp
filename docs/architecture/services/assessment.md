# Сервис: Assessment Engine — `assessment`

> Язык: Go | Слой: Прикладной | HTTP: `:8081` (за gw) | Сервис: `services/go/assessment`

## 1. Назначение

**«Экзаменатор и судья»** — оценивает действия оператора по эталону сценария, накапливает
штрафы, фиксирует критические ошибки и выдаёт итоговый вердикт. Работает **rule-based**
(детерминированно) и не зависит от ИИ (NFR-REL-03).

Реализация: **Go + REST** + Picodata + клиент к `scenario` (получение эталона).

## 2. Основные функции

- Приём событий (action/alarm) от `orchestrator` (FR-ASSESS-01/02).
- Сравнение действий с **эталоном сценария** (`reference_actions`) — берётся из `scenario`.
- Штрафы: просрочка (LATE_STEP), пропуск (MISSED_STEP), запрещённое действие (FR-ASSESS-03).
- Критические ошибки → автоматический fail (FR-ASSESS-04).
- Время реакции на аларм (FR-ASSESS-01).
- Финализация вердикта (pass/fail) по порогу (FR-ASSESS-05).
- Переопределение оценки инструктором с комментарием (FR-ASSESS-05).
- **Replay**: действия, алармы, неисправности (FR-ASSESS-06).
- **Расшифровка кодов** — отдаёт человекочитаемые `description` для алярмов/неисправностей в данных replay.

## 3. Внутренняя структура

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
deploy/config.example.toml    — пример конфигурации
```

## 4. Конфигурация

Формат — **TOML** (`deploy/config.example.toml`). Путь через флаг `-config`.

| Секция | Назначение |
|---|---|
| `[http]` | адрес/таймауты HTTP-сервера |
| `[db]` | DSN и пул соединений Picodata |
| `[clients]` | `scenario_url` — адрес сервиса scenario (эталон сценария, via HTTP + mock) |

## 5. API / контракты

| Метод | Путь | Назначение |
|---|---|---|
| POST | /assessment/event?scenario_id= | Событие от orchestrator (action/alarm) |
| GET | /assessment/session/{id}/score | Текущая оценка |
| POST | /assessment/session/{id}/result | Финализировать вердикт |
| POST | /assessment/override | Переопределить оценку (instructor) |
| GET | /assessment/session/{id}/replay | Данные для replay (с расшифровкой описаний) |

## 6. Данные

- Picodata: таблицы оценок, штрафов, вердиктов, переопределений, данные replay (append-only).
- Эталон сценария — из `scenario` (не хранится локально).

## 7. Метрики

- Число оценённых сессий/событий, задержка оценки, время до вердикта, события переопределения.

## 8. Деградация / целостность

- Rule-based — оценка не зависит от доступности ИИ.
- Append-only журнал + целостность (SHA-256/HMAC) — защита от подмены оценки (NFR-SEC-02).

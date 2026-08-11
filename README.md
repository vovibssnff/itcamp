# КТК — компьютерный тренажёрный комплекс

Система компьютерных тренажёрных комплексов для нефтеперерабатывающих установок.
Текущая математическая модель настроена под установку **ЭЛОУ-АВТ** (обессоливание,
атмосферная ректификация К-1/К-2, печи, гидроочистка). Архитектура развивается в сторону
**«Конструктора»** — платформы, где инструктор собирает установку из типовых компонентов
без программирования; часть этого функционала уже реализована.

Детальнее — [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md).

---

## Быстрый запуск

Требуется **Docker Engine ≥ 26** и **Docker Compose v2**.

```bash
# 1. Собрать образы всех слоёв
./helper/build.sh

# 2. Запустить весь стек
./helper/run.sh

# (одной командой, с пересборкой при необходимости)
./helper/run.sh --build
```

Скрипты сами создают `compose/<layer>/.env` из `.env.example` при первом запуске
(отредактируйте `compose/app/.env` — секреты JWT, БД, MinIO).

После запуска откройте **http://localhost:8090**.

Тестовые учётные записи:

| Роль | Логин | Пароль |
|---|---|---|
| Администратор | `admin` | `admin123` |
| Инструктор | `instructor` | `instructor123` |
| Оператор | `operator` | `operator123` |

> `./helper/run.sh app` / `./helper/run.sh data ai` — запуск отдельных слоёв.
> `./helper/build.sh app` — сборка только слоя `app`.

---

## Сервисы

Стек разбит на слои (Compose-проекты), разделяющие сеть `ktc-data`:

```
compose/
  data/   — инфраструктура: Picodata (БД), Radix (кэш), MinIO (S3), NATS, мигратор
  app/    — прикладные Go-сервисы + frontend
  sim/    — sim-manager, sim-worker (математическая модель)
  ai/     — ai-service + ollama (LLM)
  monitoring/ — prometheus, grafana, cadvisor
```

### Прикладной слой (Go)

| Сервис | Порт | Что делает |
|---|---|---|
| `gw` | 8088 | API Gateway/BFF — единая точка входа, проверка JWT/RBAC |
| `auth` | 8082 | Аутентификация (LDAP/stub), JWT, RBAC, TOTP |
| `constructor` | 8083 | Библиотека компонентов, шаблоны установок, валидатор, экспорт init-state |
| `scenario` | 8084 | Учебные/экзаменационные сценарии, каталог неисправностей, триггеры |
| `orchestrator` | 8085 | «Дирижёр» сессий: жизненный цикл, телеметрия 1 Гц (WS), инъекция неисправностей |
| `assessment` | 8081 | «Экзаменатор»: сравнение с эталоном, штрафы, вердикт, replay |
| `snapshot` | 8086 | Save/restore состояния сессии (S3 + Picodata + SHA-256) |
| `report` | 8087 | PDF-отчёты/протоколы (асинхронно через NATS) |

### Вычислительный / ИИ

| Сервис | Порт | Что делает |
|---|---|---|
| `sim-manager` | 8091 | Диспетчер инстансов sim-worker (per-session, квота 50) |
| `sim-worker` | 8092 | Цифровой двойник ЭЛОУ-АВТ, Model API, детерминизм 1 Гц (Python) |
| `ai` | 8089 | Explain/Predict/риски/разбор/чат-бот; детерминированное ядро + LLM (Ollama) |

### Прочее

- **frontend** (:8090) — React+TS SPA (Angie: статика + прокси `/api` → gw).
- **broker** (NATS JetStream) — асинхронная шина (отчёты, ИИ-задачи, события сессий).

---

## Структура репозитория

```
compose/    Docker Compose-слои и конфигурация (.env, config/*.toml)
services/go    Go-микросервисы (каждый: cmd/, internal/, api/openapi.yaml, deploy/)
services/python   ai-service и sim-engine (sim-worker)
frontend/   React SPA
db/         миграции БД
docs/       архитектура и требования
helper/     build.sh / run.sh
schemas/    общие доменные JSON-схемы
dashboards/ Grafana-дашборды (JSON, для импорта)
```

## Дашборды

Готовые Grafana-дашборды лежат в [`dashboards/`](dashboards/) (JSON-модели для импорта):

| Файл | Назначение |
|---|---|
| `http-overview.json` | HTTP-трафик всех Go-сервисов (RPS, ошибки, latency) |
| `services-business.json` | Бизнес-метрики Go-сервисов по сервисам |
| `ai-metrics.json` | Метрики ai-service (`ai_*`) |
| `sim-metrics.json` | Метрики sim-engine (`sim_*`) |

Слой `compose/monitoring` поднимает Prometheus + Grafana (+cAdvisor); таргеты —
`compose/monitoring/prometheus/prometheus.yml`, провижининг — `compose/monitoring/grafana/provisioning/`.
Grafana доступна на **http://localhost:3000** (admin/admin).

## Конфигурация сервисов

Все Go-сервисы читают **TOML**-конфиг (`-config`), секреты перекрываются env. Примеры —
`services/go/<name>/deploy/config.example.toml`. Локальные конфиги — в `compose/app/config/*.toml`.

Детали по каждому сервису: `docs/architecture/services/*.md`.

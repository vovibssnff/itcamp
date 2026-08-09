---
name: Локальная инфраструктура (Docker Compose)
overview: "Минимальный локальный data-plane КТК: Docker Compose (опц. Swarm) поднимает Picodata+Radix, MinIO (S3) и NATS JetStream. Без gateway, без мониторинга. Deckhouse/Istio/VKCloud — вне scope."
todos:
  - id: procure
    content: "Достать образы: Picodata CE 25.5.9, Redis@7379 (stand-in Radix), MinIO, NATS"
    status: completed
  - id: scaffold
    content: "Каркас infra/local: compose.yaml, .env.example, сеть/тома, Makefile (up/down/ps/logs/smoke)"
    status: completed
  - id: data-layer
    content: "Поднять Picodata CE + Redis-as-Radix, MinIO (+buckets), NATS JetStream; healthchecks и smoke"
    status: completed
  - id: migrate-hook
    content: "Init: SQL bootstrap Picodata, buckets MinIO, streams NATS"
    status: completed
  - id: swarm-opt
    content: "Опционально: stack-файл для Swarm (overlay, placement) без смены образов"
    status: completed
isProject: false
---

# План: локальная инфраструктура КТК (Docker Compose)

Отдельный план от [MVP](mvp_ктк_конструктор_f1ca3c09.plan.md). Только **локальный data-plane**: БД/кэш, S3, брокер. Без Deckhouse/Istio/VKCloud, без gateway, без мониторинга, без бизнес-сервисов.

**Цель:** `make up` → на машине разработчика работают Picodata+Radix, MinIO и NATS. Сервисы `auth`/`constructor`/… позже стыкуются к тем же DNS-именам контейнеров.

---

## 1. Scope

### В scope

| Компонент | Роль на локали | Источник |
|---|---|---|
| **Picodata + Radix** | СУБД (PG-wire) + Redis-совместимый кэш | образы Picodata / Radix standalone |
| **MinIO** | S3 (`snapshots`, `reports`, `component-icons`) | публичный образ |
| **NATS JetStream** | брокер (`report.tasks`, `ai.tasks`, `session.events`, …) | публичный образ |
| **init-jobs** | buckets MinIO, streams NATS, SQL bootstrap Picodata | свои скрипты в репо |

### Вне scope

- Gateway (Angie), Istio, TLS edge.
- Пульт, Графиня, Fluent Bit, Prometheus/VM — мониторинг не поднимаем.
- Terraform / VKCloud / Deckhouse.
- Бизнес-сервисы и frontend — только точки подключения (env, сеть).
- GPU/`ai`, KUMA, Vault.
- HA Raft N≥3 — следующий шаг (Swarm/K8s), не блокер local.

### Совместимость с MVP

Имена и env локали = будущие `values-dev` Helm:

```
PICODATA_DSN=postgres://ktc:***@picodata:5432/ktc
RADIX_URL=redis://radix:7379/0          # или тот же хост, если standalone
S3_ENDPOINT=http://minio:9000
NATS_URL=nats://nats:4222
```

---

## 2. Что нужно достать (procurement)

### 2.1 Обязательно до первого `compose up`

| Артефакт | Зачем | Как достать | Риск / заметка |
|---|---|---|---|
| **Docker Engine + Compose v2** | оркестрация | пакет ОС | plugin `docker compose` |
| **Доступ к registry Picodata** | образ СУБД | [picodata.io/download](https://picodata.io/en/download/) → `docker.binary.picodata.io` | возможен login / whitelist |
| **Образ Radix** | Redis-совместимый кэш = плагин Picodata | `…/radix:<ver>-standalone` | **коммерческий** — trial/лицензия; без него — Redis-fallback (только dev) |
| **MinIO** | S3 | `minio/minio`, `minio/mc` | публичный |
| **NATS** | брокер | `nats:2-alpine` + конфиг JetStream | публичный |

### 2.2 Желательно

| Артефакт | Зачем |
|---|---|
| **redis-cli / psql / mc / nats CLI** | smoke с хоста |
| **Docker Swarm** (опц.) | multi-node позже; для одного ПК не нужен |

### 2.3 Решения по Radix

1. **Целевой local:** `radix:<ver>-standalone` — один контейнер = Picodata + Radix (PG + Redis порты).
2. **Если Radix недоступен:** profile `cache-redis` (`redis:7-alpine` + отдельный `picodata`). Тот же `RADIX_URL`. Ярлык **dev-fallback**.
3. Версии — pin в `.env` / `compose.yaml`, не `latest`.

### 2.4 Чеклист «готовы к scaffold»

- [ ] `docker pull` Picodata или Radix standalone успешен
- [ ] `docker pull` MinIO / NATS успешен
- [ ] Решено: Radix standalone **или** Redis-fallback
- [ ] ≥4 GB RAM свободно (ориентир data-plane ≈ 2–3 GB)

---

## 3. Топология

```mermaid
flowchart TB
  subgraph compose ["docker compose: ktc-local"]
    pico["Picodata + Radix\nPG :5432 / Redis :7379"]
    minio["MinIO\nAPI :9000 / Console :9001"]
    nats["NATS JetStream\n:4222 / mon :8222"]
    init["init\nbuckets / streams / SQL"]
  end
  apps["auth / constructor / …\n(позже)"] --> pico
  apps --> minio
  apps --> nats
  init --> pico
  init --> minio
  init --> nats
```

**Сеть:** одна `ktc-data` — picodata/radix, minio, nats, init; позже app-сервисы attach к ней же.

**Порты на localhost:**

| Порт | Сервис | Назначение |
|---|---|---|
| `5432` | picodata | PG-wire |
| `7379` | radix | redis-cli |
| `9000` / `9001` | minio | S3 API / Console |
| `4222` / `8222` | nats | клиент / HTTP mon |

---

## 4. Структура репозитория

```
infra/
  local/
    compose.yaml
    compose.swarm.yaml          # опц.
    .env.example
    Makefile
    README.md
    data/
      picodata/                 # конфиг, если не standalone
      nats/nats.conf
      minio/init-buckets.sh
    init/
      sql/0001_bootstrap.sql
      nats/streams.json
      wait-for.sh
  ansible/ … terraform/ …       # cloud — другой план
deploy/
  data-layer/                   # позже → Helm
```

**Profiles:**

| Profile | Сервисы | Когда |
|---|---|---|
| *(default)* | picodata+radix, minio, nats, init | всегда |
| `cache-redis` | redis вместо radix | нет доступа к Radix |
| `apps` | задел под сервисы | позже |

---

## 5. Компоненты

### 5.1 Picodata + Radix

**Режим A:** сервис из `radix:<ver>-standalone`.

- Порты: Redis `7379`, PG-wire (в доке standalone — `4327`/`5327`; **сверить с версией**, снаружи замапить на `5432` или зафиксировать вендорский порт в `.env`).
- Volume `picodata-data`.
- Healthcheck: TCP/PG + `redis-cli PING`.
- Креды только из `.env`.

**Режим B (fallback):** `picodata` + `redis:7` с alias `radix`.

Init SQL на старте: БД `ktc`, роль приложения. Таблицы — Фаза 1 MVP; здесь достаточно connectivity.

### 5.2 MinIO

- `server /data --console-address ":9001"`.
- `minio-init` (`mc`): buckets `snapshots`, `reports`, `component-icons`, private.
- `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` в `.env`.
- Health: `/minio/health/live`.

### 5.3 NATS JetStream

- `jetstream { store_dir: /data }`, volume `nats-data`.
- Streams (MVP §17):
  - `REPORT_TASKS` ← `report.tasks` (workqueue)
  - `AI_TASKS` ← `ai.tasks` (workqueue)
  - `SESSION_EVENTS` ← `session.events`
  - `ASSESSMENT_EVENTS` ← `assessment.events`
- Local: **1 узел**.
- Health: `:8222/healthz`.

---

## 6. Compose vs Swarm

| | Compose | Swarm (опц.) |
|---|---|---|
| Когда | один ПК / CI | 2–3 ноды |
| Файл | `compose.yaml` | + `compose.swarm.yaml` |
| Сеть | bridge | overlay |
| Replicas | 1 | nats можно >1; Picodata standalone = 1 |

Сначала Compose single-node. HA Raft — в cloud-плане (Deckhouse), не здесь.

---

## 7. Фазы

### L0 — Procurement

- Чеклист §2.4, pin версий, решение Radix vs fallback.
- **Выход:** все нужные `docker pull` зелёные.

### L1 — Scaffold

- `infra/local/` по §4, `compose.yaml`, `.env.example`, `Makefile`.
- **Выход:** `compose config` валиден.

### L2 — Data plane

- Три сервиса + init, healthchecks, volumes.
- `make smoke`: `SELECT 1` / `PING` / `mc ls` / `nats stream ls`.
- **Выход:** data-plane зелёный.

### L3 — Init под приложения

- SQL bootstrap, README «как подключить сервис» (env, DNS, network).
- **Выход:** новый сервис стыкуется за минуты.

### L4 — Swarm override (опц.)

---

## 8. Приёмка

1. `make up` поднимает стек ≤ 2 мин (тёплый кэш образов).
2. Smoke: Picodata `SELECT 1`, Radix `PONG`, buckets MinIO есть, streams NATS на месте.
3. `down` + `up` сохраняет данные в volumes.
4. Секреты не в git; `.env.example` полный.
5. README: образы, порты, procurement, troubleshooting (Radix registry, порты).

---

## 9. Риски

| Риск | Митигация |
|---|---|
| Нет registry Radix | trial заранее; Redis-fallback с ярлыком |
| Порты standalone ≠ 5432 | `.env` (`PICODATA_PORT`) |
| Раздувание local | жёсткий scope §1 |
| Расхождение DNS с Helm | одна таблица имён в README → `values-dev` |

---

## 10. Связь с MVP

| MVP | Этот план |
|---|---|
| Фаза 0 cloud | не делаем |
| Фаза 0 data layer | **здесь** (L2) |
| `gw` / наблюдаемость §19 | вне scope; отдельные планы позже |
| Фазы 1–10 приложений | потребляют `infra/local` |

После стабилизации local те же образы/конфиги → `deploy/data-layer` (Helm).

---

## 11. Команды (после L1–L2)

```bash
cd infra/local
cp .env.example .env
make pull
make up
make smoke
```

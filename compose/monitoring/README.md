# Слой ktk-mon: мониторинг платформы

Prometheus + Grafana + cAdvisor для сбора и визуализации метрик всех
сервисов платформы «Конструктор КТК».

## Состав

- **Prometheus** — pull-хранилище метрик в формате Prometheus (`:9090`).
- **Grafana** — дашборды поверх Prometheus (`:3000`, default `admin`/`admin`).
- **cAdvisor** — метрики **всех контейнеров** (CPU/RAM/сеть/IO) через Docker
  Engine API (`:18080`, т.к. `8080` занят ai-service).

## Требуется

- Сеть `ktc-data` (создаётся слоем `compose/data`). Сам monitoring слой не
  требует приложения — targets «оживут» по мере добавления `/metrics`.

## Запуск

```bash
cp .env.example .env
docker compose up -d --build
```

- Prometheus: http://localhost:9090 (UI + `/targets`)
- Grafana:    http://localhost:3000 (admin/admin)
- cAdvisor:   http://localhost:18080

## Источники метрик (targets)

Конфиг `prometheus/prometheus.yml`:

| Target | Пример URL | Статус отдачи `/metrics` |
|--------|-----------|--------------------------|
| cAdvisor | `cadvisor:8080` | ✅ готов |
| Prometheus (self) | `localhost:9090` | ✅ готов |
| ai-service | `ai-service:8080` | ✅ готов (prometheus-client) |
| sim-worker | `sim-worker:8081` | ✅ готов (prometheus-client) |
| auth..gw, sim-manager (Go) | `*:8080` | ⛔ `/metrics` ещё не реализован |

Go-сервисы отображаются как `DOWN`, пока не добавят прометеевскую конечную
точку `/metrics` (например, через `promhttp`). Как только сервис начнёт её
отдавать, target автоматически перейдёт в `UP`.

## Порты наружу (host)

| Сервис | Хост-порт | Переменная |
|--------|-----------|------------|
| prometheus | **9090** | `PROMETHEUS_HOST_PORT` |
| grafana | **3000** | `GRAFANA_HOST_PORT` |
| cadvisor | **18080** | `CADVISOR_HOST_PORT` |

## Дашборды

Кладите готовые `.json` дашборды в `grafana/dashboards/` — они подхватятся
автоматически (provisioning provider с `updateIntervalSeconds: 10`).
DataSource `Prometheus` настраивается автоматически через
`grafana/provisioning/datasources/`.

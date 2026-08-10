# dashboards

Grafana дашборды платформы. JSON-модели дашбордов помещаются сюда
для версионирования и импорта в Grafana.

## Дашборды

| Файл | Назначение |
|------|-----------|
| `http-overview.json` | HTTP-трафик всех Go-сервисов (RPS, ошибки, latency) |
| `services-business.json` | Бизнес-метрики Go-сервисов по сервисам |
| `ai-metrics.json` | Метрики ai-service (`ai_*`) |
| `sim-metrics.json` | Метрики sim-engine (`sim_*`) |

## Метрики платформы

- **HTTP (Go-сервисы)** — `/metrics`, пакет `services/go/shared/pkg/metrics`:
  - `http_requests_total{method,path,status}`
  - `http_request_duration_seconds{method,path}`
  - `http_requests_in_flight`
- **Бизнес-метрики Go-сервисов** — в `internal/service` каждого сервиса
  (префикс `<service>_*`, напр. `constructor_templates_created_total`,
  `orchestrator_faults_injected_total`, `auth_logins_total`, `gw_*` и т.д.).
- **AI (Python ai-service)** — метрики `ai_*`
- **Sim (Python sim-worker)** — метрики `sim_*`

Прометей-таргеты: `compose/monitoring/prometheus/prometheus.yml`.
Grafana-провижининг: `compose/monitoring/grafana/provisioning/`.

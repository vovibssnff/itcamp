# dashboards

Grafana дашборды платформы. JSON-модели дашбордов помещаются сюда
для версионирования и импорта в Grafana.

## Метрики платформы

- **HTTP (Go-сервисы)** — `/metrics`, пакет `services/go/shared/pkg/metrics`:
  - `http_requests_total{method,path,status}`
  - `http_request_duration_seconds{method,path}`
  - `http_requests_in_flight`
- **AI (Python ai-service)** — метрики `ai_*`
- **Sim (Python sim-worker)** — метрики `sim_*`

Прометей-таргеты: `compose/monitoring/prometheus/prometheus.yml`.

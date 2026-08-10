package proxy

import (
	"github.com/prometheus/client_golang/prometheus"
)

// Бизнес-метрики gw. Регистрируются в дефолтном реестре Prometheus,
// который отдаёт общий /metrics-хендлер (shared/pkg/metrics.Handler).
var (
	proxiedRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gw_proxied_requests_total",
			Help: "Total proxied requests by upstream",
		},
		[]string{"upstream"},
	)
	upstreamErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gw_upstream_errors_total",
			Help: "Total upstream errors by upstream",
		},
		[]string{"upstream"},
	)
)

func init() {
	prometheus.MustRegister(proxiedRequestsTotal, upstreamErrorsTotal)
}

func IncProxiedRequest(upstream string) {
	proxiedRequestsTotal.WithLabelValues(upstream).Inc()
}

func IncUpstreamError(upstream string) {
	upstreamErrorsTotal.WithLabelValues(upstream).Inc()
}

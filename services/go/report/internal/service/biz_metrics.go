package service

import (
	"github.com/prometheus/client_golang/prometheus"
)

// Бизнес-метрики report. Регистрируются в дефолтном реестре Prometheus,
// который отдаёт общий /metrics-хендлер (shared/pkg/metrics.Handler).
var (
	reportsCreatedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "report_reports_created_total",
			Help: "Total created reports by type",
		},
		[]string{"type"},
	)
	reportsGeneratedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "report_reports_generated_total",
			Help: "Total successfully generated reports",
		},
	)
	reportsFailedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "report_reports_failed_total",
			Help: "Total failed reports",
		},
	)
)

func init() {
	prometheus.MustRegister(
		reportsCreatedTotal,
		reportsGeneratedTotal,
		reportsFailedTotal,
	)
}

func IncReportCreated(reportType string) {
	reportsCreatedTotal.WithLabelValues(reportType).Inc()
}

func IncReportGenerated() {
	reportsGeneratedTotal.Inc()
}

func IncReportFailed() {
	reportsFailedTotal.Inc()
}

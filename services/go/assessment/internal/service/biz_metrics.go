package service

import (
	"github.com/prometheus/client_golang/prometheus"
)

// Бизнес-метрики assessment. Регистрируются в дефолтном реестре Prometheus,
// который отдаёт общий /metrics-хендлер (shared/pkg/metrics.Handler).
var (
	assessmentSessionsStartedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "assessment_sessions_started_total",
			Help: "Total started assessment sessions",
		},
	)
	assessmentEventsProcessedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "assessment_events_processed_total",
			Help: "Total processed assessment events by type",
		},
		[]string{"type"},
	)
	assessmentSessionsFinalizedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "assessment_sessions_finalized_total",
			Help: "Total finalized assessment sessions by verdict",
		},
		[]string{"verdict"},
	)
	assessmentOverridesTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "assessment_overrides_total",
			Help: "Total score overrides",
		},
	)
)

func init() {
	prometheus.MustRegister(
		assessmentSessionsStartedTotal,
		assessmentEventsProcessedTotal,
		assessmentSessionsFinalizedTotal,
		assessmentOverridesTotal,
	)
}

func IncAssessmentSessionStarted() {
	assessmentSessionsStartedTotal.Inc()
}

func IncAssessmentEventProcessed(eventType string) {
	assessmentEventsProcessedTotal.WithLabelValues(eventType).Inc()
}

func IncAssessmentSessionFinalized(verdict string) {
	assessmentSessionsFinalizedTotal.WithLabelValues(verdict).Inc()
}

func IncAssessmentOverride() {
	assessmentOverridesTotal.Inc()
}

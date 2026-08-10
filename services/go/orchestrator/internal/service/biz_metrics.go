package service

import (
	"github.com/prometheus/client_golang/prometheus"
)

// Бизнес-метрики orchestrator. Регистрируются в дефолтном реестре Prometheus,
// который отдаёт общий /metrics-хендлер (shared/pkg/metrics.Handler).
var (
	sessionsCreatedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "orchestrator_sessions_created_total",
			Help: "Total created sessions by mode",
		},
		[]string{"mode"},
	)
	sessionsStartedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "orchestrator_sessions_started_total",
			Help: "Total started sessions",
		},
	)
	sessionsStoppedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "orchestrator_sessions_stopped_total",
			Help: "Total stopped sessions",
		},
	)
	sessionsPausedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "orchestrator_sessions_paused_total",
			Help: "Total paused sessions",
		},
	)
	sessionsResumedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "orchestrator_sessions_resumed_total",
			Help: "Total resumed sessions",
		},
	)
	sessionsRestoredTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "orchestrator_sessions_restored_total",
			Help: "Total restored sessions",
		},
	)
	checkpointsCreatedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "orchestrator_checkpoints_created_total",
			Help: "Total created checkpoints",
		},
	)
	operatorActionsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "orchestrator_operator_actions_total",
			Help: "Total operator actions",
		},
	)
	faultsInjectedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "orchestrator_faults_injected_total",
			Help: "Total injected faults by trigger engine",
		},
	)
)

func init() {
	prometheus.MustRegister(
		sessionsCreatedTotal,
		sessionsStartedTotal,
		sessionsStoppedTotal,
		sessionsPausedTotal,
		sessionsResumedTotal,
		sessionsRestoredTotal,
		checkpointsCreatedTotal,
		operatorActionsTotal,
		faultsInjectedTotal,
	)
}

func IncSessionCreated(mode string) {
	sessionsCreatedTotal.WithLabelValues(mode).Inc()
}

func IncSessionStarted() {
	sessionsStartedTotal.Inc()
}

func IncSessionStopped() {
	sessionsStoppedTotal.Inc()
}

func IncSessionPaused() {
	sessionsPausedTotal.Inc()
}

func IncSessionResumed() {
	sessionsResumedTotal.Inc()
}

func IncSessionRestored() {
	sessionsRestoredTotal.Inc()
}

func IncCheckpointCreated() {
	checkpointsCreatedTotal.Inc()
}

func IncOperatorAction() {
	operatorActionsTotal.Inc()
}

func IncFaultInjected() {
	faultsInjectedTotal.Inc()
}

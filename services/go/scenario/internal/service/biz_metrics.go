package service

import (
	"github.com/prometheus/client_golang/prometheus"
)

// Бизнес-метрики scenario. Регистрируются в дефолтном реестре Prometheus,
// который отдаёт общий /metrics-хендлер (shared/pkg/metrics.Handler).
var (
	scenariosCreatedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "scenario_scenarios_created_total",
			Help: "Total created scenarios by type",
		},
		[]string{"type"},
	)
	scenariosUpdatedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "scenario_scenarios_updated_total",
			Help: "Total updated scenarios",
		},
	)
	scenariosDeletedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "scenario_scenarios_deleted_total",
			Help: "Total deleted scenarios",
		},
	)
	scenariosClonedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "scenario_scenarios_cloned_total",
			Help: "Total cloned scenarios",
		},
	)
	triggerValidationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "scenario_trigger_validations_total",
			Help: "Total trigger validations by result",
		},
		[]string{"result"},
	)
)

func init() {
	prometheus.MustRegister(
		scenariosCreatedTotal,
		scenariosUpdatedTotal,
		scenariosDeletedTotal,
		scenariosClonedTotal,
		triggerValidationsTotal,
	)
}

func IncScenarioCreated(sType string) {
	scenariosCreatedTotal.WithLabelValues(sType).Inc()
}

func IncScenarioUpdated() {
	scenariosUpdatedTotal.Inc()
}

func IncScenarioDeleted() {
	scenariosDeletedTotal.Inc()
}

func IncScenarioCloned() {
	scenariosClonedTotal.Inc()
}

func IncTriggerValidation(result string) {
	triggerValidationsTotal.WithLabelValues(result).Inc()
}

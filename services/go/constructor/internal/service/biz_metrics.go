package service

import (
	"github.com/prometheus/client_golang/prometheus"
)

// Бизнес-метрики constructor. Регистрируются в дефолтном реестре Prometheus,
// который отдаёт общий /metrics-хендлер (shared/pkg/metrics.Handler).
var (
	templatesCreatedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "constructor_templates_created_total",
			Help: "Total created templates by status",
		},
		[]string{"status"},
	)
	templatesUpdatedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "constructor_templates_updated_total",
			Help: "Total updated templates",
		},
	)
	templatesDeletedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "constructor_templates_deleted_total",
			Help: "Total deleted/archived templates by force flag",
		},
		[]string{"force"},
	)
	templateValidationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "constructor_template_validations_total",
			Help: "Total template validations by result",
		},
		[]string{"result"},
	)
	componentsCreatedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "constructor_components_created_total",
			Help: "Total created components",
		},
	)
)

func init() {
	prometheus.MustRegister(
		templatesCreatedTotal,
		templatesUpdatedTotal,
		templatesDeletedTotal,
		templateValidationsTotal,
		componentsCreatedTotal,
	)
}

func IncTemplateCreated(status string) {
	templatesCreatedTotal.WithLabelValues(status).Inc()
}

func IncTemplateUpdated() {
	templatesUpdatedTotal.Inc()
}

func IncTemplateDeleted(force bool) {
	templatesDeletedTotal.WithLabelValues(strconvBool(force)).Inc()
}

func IncTemplateValidation(result string) {
	templateValidationsTotal.WithLabelValues(result).Inc()
}

func IncComponentCreated() {
	componentsCreatedTotal.Inc()
}

func strconvBool(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

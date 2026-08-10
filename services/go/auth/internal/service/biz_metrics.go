package service

import (
	"github.com/prometheus/client_golang/prometheus"
)

// Бизнес-метрики auth. Регистрируются в дефолтном реестре Prometheus,
// который отдаёт общий /metrics-хендлер (shared/pkg/metrics.Handler).
var (
	authLoginsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "auth_logins_total",
			Help: "Total login attempts by result",
		},
		[]string{"result"},
	)
	authRefreshesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "auth_refreshes_total",
			Help: "Total refresh-token operations by result",
		},
		[]string{"result"},
	)
	authUsersCreatedTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "auth_users_created_total",
			Help: "Total auto-created users on first login",
		},
	)
	mfaEnabledTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "auth_mfa_enabled_total",
			Help: "Total MFA-enabled users",
		},
	)
	mfaDisabledTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "auth_mfa_disabled_total",
			Help: "Total MFA-disabled users",
		},
	)
	mfaVerificationsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "auth_mfa_verifications_total",
			Help: "Total MFA code verifications by result",
		},
		[]string{"result"},
	)
)

func init() {
	prometheus.MustRegister(
		authLoginsTotal,
		authRefreshesTotal,
		authUsersCreatedTotal,
		mfaEnabledTotal,
		mfaDisabledTotal,
		mfaVerificationsTotal,
	)
}

func IncAuthLogin(result string) {
	authLoginsTotal.WithLabelValues(result).Inc()
}

func IncAuthRefresh(result string) {
	authRefreshesTotal.WithLabelValues(result).Inc()
}

func IncAuthUserCreated() {
	authUsersCreatedTotal.Inc()
}

func IncMFAEnabled() {
	mfaEnabledTotal.Inc()
}

func IncMFADisabled() {
	mfaDisabledTotal.Inc()
}

func IncMFAVerification(result string) {
	mfaVerificationsTotal.WithLabelValues(result).Inc()
}

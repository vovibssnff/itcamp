package service

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
)

func counterValue(t *testing.T, name string, labels map[string]string) float64 {
	t.Helper()
	families, err := prometheus.DefaultGatherer.Gather()
	if err != nil {
		t.Fatalf("gather: %v", err)
	}
	for _, f := range families {
		if f.GetName() != name {
			continue
		}
		for _, m := range f.Metric {
			if matchLabels(m, labels) {
				return m.GetCounter().GetValue()
			}
		}
	}
	return 0
}

func matchLabels(m *dto.Metric, want map[string]string) bool {
	if len(m.Label) != len(want) {
		return len(m.Label) == 0 && len(want) == 0
	}
	for _, lp := range m.Label {
		if v, ok := want[lp.GetName()]; !ok || lp.GetValue() != v {
			return false
		}
	}
	return true
}

func TestBizMetrics_AuthLoginResult(t *testing.T) {
	before := counterValue(t, "auth_logins_total", map[string]string{"result": "success"})
	IncAuthLogin("success")
	IncAuthLogin("success")
	after := counterValue(t, "auth_logins_total", map[string]string{"result": "success"})
	if after-before != 2 {
		t.Fatalf("login success delta = %v, want 2", after-before)
	}
}

func TestBizMetrics_MFAVerification(t *testing.T) {
	validBefore := counterValue(t, "auth_mfa_verifications_total", map[string]string{"result": "valid"})
	invalidBefore := counterValue(t, "auth_mfa_verifications_total", map[string]string{"result": "invalid"})

	IncMFAVerification("valid")
	IncMFAVerification("invalid")

	validAfter := counterValue(t, "auth_mfa_verifications_total", map[string]string{"result": "valid"})
	invalidAfter := counterValue(t, "auth_mfa_verifications_total", map[string]string{"result": "invalid"})

	if validAfter-validBefore != 1 {
		t.Fatalf("valid delta = %v, want 1", validAfter-validBefore)
	}
	if invalidAfter-invalidBefore != 1 {
		t.Fatalf("invalid delta = %v, want 1", invalidAfter-invalidBefore)
	}
}

func TestBizMetrics_PlainCounters(t *testing.T) {
	refreshBefore := counterValue(t, "auth_refreshes_total", map[string]string{"result": "success"})
	IncAuthRefresh("success")
	refreshAfter := counterValue(t, "auth_refreshes_total", map[string]string{"result": "success"})
	if refreshAfter-refreshBefore != 1 {
		t.Fatalf("refresh delta = %v, want 1", refreshAfter-refreshBefore)
	}

	usersBefore := counterValue(t, "auth_users_created_total", map[string]string{})
	IncAuthUserCreated()
	usersAfter := counterValue(t, "auth_users_created_total", map[string]string{})
	if usersAfter-usersBefore != 1 {
		t.Fatalf("users created delta = %v, want 1", usersAfter-usersBefore)
	}

	mfaBefore := counterValue(t, "auth_mfa_enabled_total", map[string]string{})
	IncMFAEnabled()
	mfaAfter := counterValue(t, "auth_mfa_enabled_total", map[string]string{})
	if mfaAfter-mfaBefore != 1 {
		t.Fatalf("mfa enabled delta = %v, want 1", mfaAfter-mfaBefore)
	}
}

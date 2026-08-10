package proxy

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

func TestBizMetrics_ProxiedByUpstream(t *testing.T) {
	before := counterValue(t, "gw_proxied_requests_total", map[string]string{"upstream": "constructor"})
	IncProxiedRequest("constructor")
	IncProxiedRequest("constructor")
	after := counterValue(t, "gw_proxied_requests_total", map[string]string{"upstream": "constructor"})
	if after-before != 2 {
		t.Fatalf("proxied delta = %v, want 2", after-before)
	}
}

func TestBizMetrics_UpstreamError(t *testing.T) {
	before := counterValue(t, "gw_upstream_errors_total", map[string]string{"upstream": "auth"})
	IncUpstreamError("auth")
	after := counterValue(t, "gw_upstream_errors_total", map[string]string{"upstream": "auth"})
	if after-before != 1 {
		t.Fatalf("error delta = %v, want 1", after-before)
	}
}

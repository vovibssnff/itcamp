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

func TestBizMetrics_SessionCreatedByMode(t *testing.T) {
	before := counterValue(t, "orchestrator_sessions_created_total", map[string]string{"mode": "exam"})
	IncSessionCreated("exam")
	IncSessionCreated("exam")
	after := counterValue(t, "orchestrator_sessions_created_total", map[string]string{"mode": "exam"})
	if after-before != 2 {
		t.Fatalf("created delta = %v, want 2", after-before)
	}
}

func TestBizMetrics_PlainCounters(t *testing.T) {
	counts := map[string]float64{
		"orchestrator_sessions_started_total":   0,
		"orchestrator_sessions_stopped_total":   0,
		"orchestrator_sessions_paused_total":    0,
		"orchestrator_checkpoints_created_total": 0,
		"orchestrator_operator_actions_total":   0,
		"orchestrator_faults_injected_total":    0,
	}
	for name := range counts {
		counts[name] = counterValue(t, name, map[string]string{})
	}

	IncSessionStarted()
	IncSessionStopped()
	IncSessionPaused()
	IncCheckpointCreated()
	IncOperatorAction()
	IncFaultInjected()

	deltas := map[string]float64{
		"orchestrator_sessions_started_total":   counterValue(t, "orchestrator_sessions_started_total", map[string]string{}) - counts["orchestrator_sessions_started_total"],
		"orchestrator_sessions_stopped_total":   counterValue(t, "orchestrator_sessions_stopped_total", map[string]string{}) - counts["orchestrator_sessions_stopped_total"],
		"orchestrator_sessions_paused_total":    counterValue(t, "orchestrator_sessions_paused_total", map[string]string{}) - counts["orchestrator_sessions_paused_total"],
		"orchestrator_checkpoints_created_total": counterValue(t, "orchestrator_checkpoints_created_total", map[string]string{}) - counts["orchestrator_checkpoints_created_total"],
		"orchestrator_operator_actions_total":   counterValue(t, "orchestrator_operator_actions_total", map[string]string{}) - counts["orchestrator_operator_actions_total"],
		"orchestrator_faults_injected_total":    counterValue(t, "orchestrator_faults_injected_total", map[string]string{}) - counts["orchestrator_faults_injected_total"],
	}
	for name, delta := range deltas {
		if delta != 1 {
			t.Fatalf("%s delta = %v, want 1", name, delta)
		}
	}
}

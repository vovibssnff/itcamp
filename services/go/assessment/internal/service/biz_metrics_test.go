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

func TestBizMetrics_EventProcessedByType(t *testing.T) {
	before := counterValue(t, "assessment_events_processed_total", map[string]string{"type": "action"})
	IncAssessmentEventProcessed("action")
	IncAssessmentEventProcessed("action")
	after := counterValue(t, "assessment_events_processed_total", map[string]string{"type": "action"})
	if after-before != 2 {
		t.Fatalf("action delta = %v, want 2", after-before)
	}
}

func TestBizMetrics_FinalizedByVerdict(t *testing.T) {
	before := counterValue(t, "assessment_sessions_finalized_total", map[string]string{"verdict": "pass"})
	IncAssessmentSessionFinalized("pass")
	after := counterValue(t, "assessment_sessions_finalized_total", map[string]string{"verdict": "pass"})
	if after-before != 1 {
		t.Fatalf("pass delta = %v, want 1", after-before)
	}
}

func TestBizMetrics_PlainCounters(t *testing.T) {
	startedBefore := counterValue(t, "assessment_sessions_started_total", map[string]string{})
	IncAssessmentSessionStarted()
	startedAfter := counterValue(t, "assessment_sessions_started_total", map[string]string{})
	if startedAfter-startedBefore != 1 {
		t.Fatalf("started delta = %v, want 1", startedAfter-startedBefore)
	}

	overridesBefore := counterValue(t, "assessment_overrides_total", map[string]string{})
	IncAssessmentOverride()
	overridesAfter := counterValue(t, "assessment_overrides_total", map[string]string{})
	if overridesAfter-overridesBefore != 1 {
		t.Fatalf("override delta = %v, want 1", overridesAfter-overridesBefore)
	}
}

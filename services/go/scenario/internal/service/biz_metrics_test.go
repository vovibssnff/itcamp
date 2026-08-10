package service

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
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

func fptr(v float64) *float64 { return &v }

func TestBizMetrics_ScenarioCreatedByType(t *testing.T) {
	before := counterValue(t, "scenario_scenarios_created_total", map[string]string{"type": "exam"})
	IncScenarioCreated("exam")
	IncScenarioCreated("exam")
	after := counterValue(t, "scenario_scenarios_created_total", map[string]string{"type": "exam"})
	if after-before != 2 {
		t.Fatalf("created delta = %v, want 2", after-before)
	}
}

func TestBizMetrics_TriggerValidationResult(t *testing.T) {
	v := NewTriggerValidator()

	beforeValid := counterValue(t, "scenario_trigger_validations_total", map[string]string{"result": "valid"})
	if err := v.ValidateTrigger(domain.Trigger{Type: domain.TriggerTime, AtModelTime: fptr(3)}); err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	afterValid := counterValue(t, "scenario_trigger_validations_total", map[string]string{"result": "valid"})
	if afterValid-beforeValid != 1 {
		t.Fatalf("valid delta = %v, want 1", afterValid-beforeValid)
	}

	beforeInvalid := counterValue(t, "scenario_trigger_validations_total", map[string]string{"result": "invalid"})
	_ = v.ValidateTrigger(domain.Trigger{Type: "bogus"}) // unknown type -> invalid
	afterInvalid := counterValue(t, "scenario_trigger_validations_total", map[string]string{"result": "invalid"})
	if afterInvalid-beforeInvalid != 1 {
		t.Fatalf("invalid delta = %v, want 1", afterInvalid-beforeInvalid)
	}
}

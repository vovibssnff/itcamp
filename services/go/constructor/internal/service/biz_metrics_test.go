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

func TestBizMetrics_TemplateCreated(t *testing.T) {
	before := counterValue(t, "constructor_templates_created_total", map[string]string{"status": "draft"})
	IncTemplateCreated("draft")
	IncTemplateCreated("draft")
	after := counterValue(t, "constructor_templates_created_total", map[string]string{"status": "draft"})
	if after-before != 2 {
		t.Fatalf("template created count delta = %v, want 2", after-before)
	}
}

func TestBizMetrics_TemplateDeletedForceLabel(t *testing.T) {
	beforeTrue := counterValue(t, "constructor_templates_deleted_total", map[string]string{"force": "true"})
	beforeFalse := counterValue(t, "constructor_templates_deleted_total", map[string]string{"force": "false"})

	IncTemplateDeleted(true)
	IncTemplateDeleted(false)

	afterTrue := counterValue(t, "constructor_templates_deleted_total", map[string]string{"force": "true"})
	afterFalse := counterValue(t, "constructor_templates_deleted_total", map[string]string{"force": "false"})

	if afterTrue-beforeTrue != 1 {
		t.Fatalf("force delete delta = %v, want 1", afterTrue-beforeTrue)
	}
	if afterFalse-beforeFalse != 1 {
		t.Fatalf("archive delta = %v, want 1", afterFalse-beforeFalse)
	}
}

func TestBizMetrics_ValidationResultLabel(t *testing.T) {
	beforeValid := counterValue(t, "constructor_template_validations_total", map[string]string{"result": "valid"})
	beforeInvalid := counterValue(t, "constructor_template_validations_total", map[string]string{"result": "invalid"})

	IncTemplateValidation("valid")
	IncTemplateValidation("invalid")

	afterValid := counterValue(t, "constructor_template_validations_total", map[string]string{"result": "valid"})
	afterInvalid := counterValue(t, "constructor_template_validations_total", map[string]string{"result": "invalid"})

	if afterValid-beforeValid != 1 {
		t.Fatalf("valid delta = %v, want 1", afterValid-beforeValid)
	}
	if afterInvalid-beforeInvalid != 1 {
		t.Fatalf("invalid delta = %v, want 1", afterInvalid-beforeInvalid)
	}
}

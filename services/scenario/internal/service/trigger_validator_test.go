package service

import (
	"testing"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
)

func TestTriggerValidator_TimeTrigger_Valid(t *testing.T) {
	v := NewTriggerValidator()
	t120 := float64(120)
	err := v.ValidateTrigger(domain.Trigger{Type: domain.TriggerTime, AtModelTime: &t120})
	if err != nil {
		t.Fatalf("expected valid, got %v", err)
	}
}

func TestTriggerValidator_TimeTrigger_MissingTime(t *testing.T) {
	v := NewTriggerValidator()
	err := v.ValidateTrigger(domain.Trigger{Type: domain.TriggerTime})
	if err == nil {
		t.Fatal("expected error for missing at_model_time")
	}
}

func TestTriggerValidator_ConditionTrigger_Valid(t *testing.T) {
	v := NewTriggerValidator()
	err := v.ValidateTrigger(domain.Trigger{
		Type: domain.TriggerCondition,
		Condition: &domain.ConditionSpec{Tag: "PRSA-204", Op: domain.OpGTE, Value: 4.5},
	})
	if err != nil {
		t.Fatalf("expected valid, got %v", err)
	}
}

func TestTriggerValidator_ConditionTrigger_MissingCondition(t *testing.T) {
	v := NewTriggerValidator()
	err := v.ValidateTrigger(domain.Trigger{Type: domain.TriggerCondition})
	if err == nil {
		t.Fatal("expected error for missing condition")
	}
}

func TestTriggerValidator_ConditionTrigger_MissingTag(t *testing.T) {
	v := NewTriggerValidator()
	err := v.ValidateTrigger(domain.Trigger{
		Type: domain.TriggerCondition,
		Condition: &domain.ConditionSpec{Op: domain.OpGTE, Value: 4.5},
	})
	if err == nil {
		t.Fatal("expected error for missing tag")
	}
}

func TestTriggerValidator_ConditionTrigger_InvalidOp(t *testing.T) {
	v := NewTriggerValidator()
	err := v.ValidateTrigger(domain.Trigger{
		Type: domain.TriggerCondition,
		Condition: &domain.ConditionSpec{Tag: "PRSA-204", Op: "!=", Value: 4.5},
	})
	if err == nil {
		t.Fatal("expected error for invalid op")
	}
}

func TestTriggerValidator_UnknownType(t *testing.T) {
	v := NewTriggerValidator()
	err := v.ValidateTrigger(domain.Trigger{Type: "unknown"})
	if err == nil {
		t.Fatal("expected error for unknown trigger type")
	}
}

func TestTriggerValidator_Scenario_EmptyName(t *testing.T) {
	v := NewTriggerValidator()
	err := v.ValidateScenario(domain.Scenario{})
	if err == nil {
		t.Fatal("expected error for empty name")
	}
}

func TestTriggerValidator_Scenario_FaultMissingFaultID(t *testing.T) {
	v := NewTriggerValidator()
	t120 := float64(120)
	err := v.ValidateScenario(domain.Scenario{
		Name: "test",
		Faults: []domain.ScenarioFault{
			{ID: "f1", Trigger: domain.Trigger{Type: domain.TriggerTime, AtModelTime: &t120}},
		},
	})
	if err == nil {
		t.Fatal("expected error for missing fault_id")
	}
}

func TestTriggerValidator_Scenario_Valid(t *testing.T) {
	v := NewTriggerValidator()
	t120 := float64(120)
	err := v.ValidateScenario(domain.Scenario{
		Name: "Test scenario",
		Faults: []domain.ScenarioFault{
			{ID: "f1", FaultID: "pressure_rise_K1", ComponentInstanceID: "column-k1",
				Trigger: domain.Trigger{Type: domain.TriggerTime, AtModelTime: &t120}},
		},
	})
	if err != nil {
		t.Fatalf("expected valid, got %v", err)
	}
}

func TestValidOp_AllOps(t *testing.T) {
	cases := []domain.ComparisonOp{
		domain.OpGTE, domain.OpLTE, domain.OpGT, domain.OpLT, domain.OpEQ,
	}
	for _, op := range cases {
		if !validOp(op) {
			t.Errorf("expected %s to be valid", op)
		}
	}
}

func TestValidOp_Invalid(t *testing.T) {
	if validOp("!=") {
		t.Error("expected != to be invalid")
	}
	if validOp("") {
		t.Error("expected empty to be invalid")
	}
}

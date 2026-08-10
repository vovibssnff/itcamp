package service

import (
	"fmt"

	"github.com/itcamp/ktc/services/scenario/internal/domain"
)

type TriggerValidator struct{}

func NewTriggerValidator() *TriggerValidator {
	return &TriggerValidator{}
}

func (v *TriggerValidator) ValidateScenario(sc domain.Scenario) error {
	if sc.Name == "" {
		return fmt.Errorf("%w: scenario name is required", domain.ErrValidationFailed)
	}
	for i := range sc.Faults {
		if err := v.ValidateTrigger(sc.Faults[i].Trigger); err != nil {
			return fmt.Errorf("fault %s: %w", sc.Faults[i].ID, err)
		}
		if sc.Faults[i].FaultID == "" {
			return fmt.Errorf("%w: fault %d: fault_id is required", domain.ErrValidationFailed, i)
		}
	}
	return nil
}

func (v *TriggerValidator) ValidateTrigger(t domain.Trigger) error {
	if err := v.validateTrigger(t); err != nil {
		IncTriggerValidation("invalid")
		return err
	}
	IncTriggerValidation("valid")
	return nil
}

func (v *TriggerValidator) validateTrigger(t domain.Trigger) error {
	switch t.Type {
	case domain.TriggerTime:
		if t.AtModelTime == nil {
			return fmt.Errorf("%w: time trigger requires at_model_time", domain.ErrInvalidTrigger)
		}
	case domain.TriggerCondition:
		if t.Condition == nil {
			return fmt.Errorf("%w: condition trigger requires condition", domain.ErrInvalidTrigger)
		}
		if t.Condition.Tag == "" {
			return fmt.Errorf("%w: condition.tag is required", domain.ErrInvalidTrigger)
		}
		if !validOp(t.Condition.Op) {
			return fmt.Errorf("%w: invalid op %s", domain.ErrInvalidTrigger, t.Condition.Op)
		}
	default:
		return fmt.Errorf("%w: unknown trigger type %s", domain.ErrInvalidTrigger, t.Type)
	}
	return nil
}

func validOp(op domain.ComparisonOp) bool {
	switch op {
	case domain.OpGTE, domain.OpLTE, domain.OpGT, domain.OpLT, domain.OpEQ:
		return true
	}
	return false
}

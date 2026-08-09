package domain

type ScenarioType string

const (
	ScenarioTraining ScenarioType = "training"
	ScenarioExam     ScenarioType = "exam"
)

type TriggerType string

const (
	TriggerTime      TriggerType = "time"
	TriggerCondition TriggerType = "condition"
)

type ComparisonOp string

const (
	OpGTE ComparisonOp = ">="
	OpLTE ComparisonOp = "<="
	OpGT  ComparisonOp = ">"
	OpLT  ComparisonOp = "<"
	OpEQ  ComparisonOp = "=="
)

type FaultSeverity string

const (
	SeverityLow      FaultSeverity = "low"
	SeverityMedium   FaultSeverity = "medium"
	SeverityHigh     FaultSeverity = "high"
	SeverityCritical FaultSeverity = "critical"
)

type FaultParams struct {
	SeverityPct float64 `json:"severity_pct"`
	RampSeconds float64 `json:"ramp_seconds"`
}

type Trigger struct {
	Type        TriggerType    `json:"type"`
	AtModelTime *float64       `json:"at_model_time,omitempty"`
	Condition   *ConditionSpec `json:"condition,omitempty"`
}

type ConditionSpec struct {
	Tag        string       `json:"tag"`
	Op         ComparisonOp `json:"op"`
	Value      float64      `json:"value"`
	ForSeconds *float64     `json:"for_seconds,omitempty"`
}

type ScenarioFault struct {
	ID                  string      `json:"id"`
	FaultID             string      `json:"fault_id"`
	ComponentInstanceID string      `json:"component_instance_id"`
	Params              FaultParams `json:"params"`
	Trigger             Trigger     `json:"trigger"`
	Hidden              bool        `json:"hidden"`
}

type ReferenceAction struct {
	Step            int            `json:"step"`
	Description     string         `json:"description"`
	Expected        ExpectedAction `json:"expected"`
	DeadlineSeconds int            `json:"deadline_seconds"`
	Mandatory       bool           `json:"mandatory"`
}

type ExpectedAction struct {
	Target string `json:"target"`
	Action string `json:"action"`
	Value  any    `json:"value,omitempty"`
}

type Criteria struct {
	MaxScore         int      `json:"max_score"`
	PenaltyLate      int      `json:"penalty_late"`
	PenaltyMiss      int      `json:"penalty_miss"`
	PenaltyForbidden int      `json:"penalty_forbidden"`
	CriticalActions  []string `json:"critical_actions"`
	PassThreshold    int      `json:"pass_threshold"`
}

type Scenario struct {
	ID               string            `json:"id"`
	TemplateID       string            `json:"template_id"`
	Name             string            `json:"name"`
	Description      string            `json:"description"`
	Type             ScenarioType      `json:"type"`
	StartPresetID    string            `json:"start_preset_id,omitempty"`
	Faults           []ScenarioFault   `json:"faults"`
	ReferenceActions []ReferenceAction `json:"reference_actions"`
	Criteria         Criteria          `json:"criteria"`
	AuthorID         string            `json:"author_id"`
	CreatedAt        string            `json:"created_at"`
}

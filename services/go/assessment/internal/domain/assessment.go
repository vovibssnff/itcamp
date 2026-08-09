package domain

type Verdict string

const (
	VerdictPending Verdict = "pending"
	VerdictPass    Verdict = "pass"
	VerdictFail    Verdict = "fail"
)

type AssessmentEvent struct {
	SessionID  string  `json:"session_id"`
	Type       string  `json:"type"`
	UserID     string  `json:"user_id,omitempty"`
	Target     string  `json:"target,omitempty"`
	Action     string  `json:"action,omitempty"`
	Value      any     `json:"value,omitempty"`
	TagID      string  `json:"tag_id,omitempty"`
	Priority   string  `json:"priority,omitempty"`
	ModelTime  float64 `json:"model_time"`
	ServerTime string  `json:"server_time,omitempty"`
}

type Penalty struct {
	Code        string  `json:"code"`
	Description string  `json:"description"`
	Points      int     `json:"points"`
	ModelTime   float64 `json:"model_time"`
}

type CriticalError struct {
	Code        string  `json:"code"`
	Description string  `json:"description"`
	ModelTime   float64 `json:"model_time"`
}

type ReactionTime struct {
	AlarmID string  `json:"alarm_id"`
	Seconds float64 `json:"seconds"`
}

type Score struct {
	SessionID       string          `json:"session_id"`
	ReactionTimes   []ReactionTime  `json:"reaction_times"`
	Penalties       []Penalty       `json:"penalties"`
	CriticalErrors  []CriticalError `json:"critical_errors"`
	TotalScore      int             `json:"total_score"`
	Verdict         Verdict         `json:"verdict"`
}

type Override struct {
	SessionID string `json:"session_id"`
	NewScore  int    `json:"new_score"`
	Verdict   Verdict `json:"verdict"`
	Comment   string `json:"comment"`
	ByUserID  string `json:"by_user_id"`
}

type ReferenceAction struct {
	Step            int             `json:"step"`
	Description     string          `json:"description"`
	Expected        ExpectedAction  `json:"expected"`
	DeadlineSeconds int             `json:"deadline_seconds"`
	Mandatory       bool            `json:"mandatory"`
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

type ScenarioData struct {
	ReferenceActions []ReferenceAction `json:"reference_actions"`
	Criteria         Criteria          `json:"criteria"`
}

type ReplayData struct {
	Actions []any `json:"actions"`
	Alarms  []any `json:"alarms"`
	Faults  []any `json:"faults"`
}

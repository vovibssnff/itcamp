package domain

import "time"

type SessionStatus string

const (
	StatusCreated  SessionStatus = "created"
	StatusRunning  SessionStatus = "running"
	StatusPaused   SessionStatus = "paused"
	StatusStopped  SessionStatus = "stopped"
	StatusFinished SessionStatus = "finished"
)

type SessionMode string

const (
	ModeTraining SessionMode = "training"
	ModeExam     SessionMode = "exam"
	ModeDemo     SessionMode = "demo"
)

type Session struct {
	ID           string        `json:"id"`
	TemplateID   string        `json:"template_id"`
	ScenarioID   string        `json:"scenario_id"`
	OperatorIDs  []string      `json:"operator_ids"`
	InstructorID string        `json:"instructor_id"`
	Mode         SessionMode   `json:"mode"`
	Speed        float64       `json:"speed"`
	Status       SessionStatus `json:"status"`
	ModelTime    float64       `json:"model_time"`
	StartedAt    *time.Time    `json:"started_at,omitempty"`
	StoppedAt    *time.Time    `json:"stopped_at,omitempty"`
	CreatedAt    time.Time     `json:"created_at"`
}

type OperatorAction struct {
	ID         string    `json:"id"`
	SessionID  string    `json:"session_id"`
	UserID     string    `json:"user_id"`
	Type       string    `json:"type"`
	Target     string    `json:"target"`
	Action     string    `json:"action"`
	Value      any       `json:"value,omitempty"`
	ModelTime  float64   `json:"model_time"`
	ServerTime time.Time `json:"server_time"`
}

type AlarmEvent struct {
	ID              string   `json:"id"`
	SessionID       string   `json:"session_id"`
	TagID           string   `json:"tag_id"`
	Priority        string   `json:"priority"`
	RaisedModelTime float64  `json:"raised_model_time"`
	AckModelTime    *float64 `json:"ack_model_time,omitempty"`
	AckUserID       string   `json:"ack_user_id,omitempty"`
}

type FaultEvent struct {
	ID             string  `json:"id"`
	SessionID      string  `json:"session_id"`
	FaultID        string  `json:"fault_id"`
	ComponentID    string  `json:"component_instance_id"`
	TriggerType    string  `json:"trigger_type"`
	FiredModelTime float64 `json:"fired_model_time"`
}

type Tag struct {
	TagID   string  `json:"tag_id"`
	Value   float64 `json:"value"`
	Unit    string  `json:"unit"`
	Quality string  `json:"quality"`
}

type Regulator struct {
	TagID string  `json:"tag_id"`
	PV    float64 `json:"pv"`
	SP    float64 `json:"sp"`
	OUT   float64 `json:"out"`
	Mode  string  `json:"mode"`
}

type Telemetry struct {
	ModelTime  float64      `json:"model_time"`
	Tags       []Tag        `json:"tags"`
	Alarms     []AlarmEvent `json:"alarms"`
	Regulators []Regulator  `json:"regulators"`
}

type SimState struct {
	SessionID       string       `json:"session_id"`
	ModelTime       float64      `json:"model_time"`
	Seed            int64        `json:"seed"`
	Tags            []Tag        `json:"tags"`
	Regulators      []Regulator  `json:"regulators"`
	Alarms          []AlarmEvent `json:"alarms"`
	ComponentsState string       `json:"components_state_json"`
	SchemaVersion   string       `json:"schema_version"`
}

type InjectFaultReq struct {
	SessionID           string  `json:"session_id"`
	FaultID             string  `json:"fault_id"`
	ComponentInstanceID string  `json:"component_instance_id"`
	SeverityPct         float64 `json:"severity_pct"`
	RampSeconds         float64 `json:"ramp_seconds"`
}

package domain

import "errors"

type ReportStatus string

const (
	StatusQueued     ReportStatus = "queued"
	StatusProcessing ReportStatus = "processing"
	StatusReady      ReportStatus = "ready"
	StatusFailed     ReportStatus = "failed"
)

type ReportType string

const (
	ReportSession ReportType = "session"
	ReportExam    ReportType = "exam"
)

type Report struct {
	ID            string       `json:"id"`
	SessionID     string       `json:"session_id"`
	Type          ReportType   `json:"type"`
	Status        ReportStatus `json:"status"`
	CanonicalJSON string       `json:"canonical_json,omitempty"`
	StorageKey    string       `json:"storage_key,omitempty"`
	DownloadURL   string       `json:"download_url,omitempty"`
	Error         string       `json:"error,omitempty"`
	CreatedAt     string       `json:"created_at"`
	UpdatedAt     string       `json:"updated_at"`
}

type CreateReportRequest struct {
	SessionID string     `json:"session_id"`
	Type      ReportType `json:"type"`
}

type ReportTask struct {
	ReportID  string `json:"report_id"`
	SessionID string `json:"session_id"`
	Type      string `json:"type"`
}

type SessionData struct {
	SessionID    string         `json:"session_id"`
	OperatorID   string         `json:"operator_id"`
	ScenarioName string         `json:"scenario_name"`
	Mode         string         `json:"mode"`
	ModelTime    float64        `json:"model_time"`
	StartedAt    string         `json:"started_at"`
	StoppedAt    string         `json:"stopped_at"`
	Score        int            `json:"score"`
	Verdict      string         `json:"verdict"`
	Penalties    []PenaltyData  `json:"penalties"`
	CriticalErrs []CriticalData `json:"critical_errors"`
	Actions      []ActionData   `json:"actions"`
	Alarms       []AlarmData    `json:"alarms"`
	Faults       []FaultData    `json:"faults"`
}

type PenaltyData struct {
	Code        string  `json:"code"`
	Description string  `json:"description"`
	Points      int     `json:"points"`
	ModelTime   float64 `json:"model_time"`
}

type CriticalData struct {
	Code        string  `json:"code"`
	Description string  `json:"description"`
	ModelTime   float64 `json:"model_time"`
}

type ActionData struct {
	Target    string  `json:"target"`
	Action    string  `json:"action"`
	ModelTime float64 `json:"model_time"`
}

type AlarmData struct {
	TagID     string  `json:"tag_id"`
	Priority  string  `json:"priority"`
	ModelTime float64 `json:"model_time"`
}

type FaultData struct {
	FaultID   string  `json:"fault_id"`
	ModelTime float64 `json:"model_time"`
}

var (
	ErrBadRequest       = errors.New("bad request")
	ErrReportNotFound   = errors.New("report not found")
	ErrReportNotReady   = errors.New("report is not ready")
	ErrGenerationFailed = errors.New("report generation failed")
)

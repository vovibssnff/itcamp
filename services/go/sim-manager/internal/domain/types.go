package domain

import "errors"

type Phase string

const (
	PhaseCreated Phase = "created"
	PhasePending Phase = "pending"
	PhaseReady   Phase = "ready"
	PhaseFailed  Phase = "failed"
	PhaseStopped Phase = "stopped"
)

type InstanceSpec struct {
	SessionID    string `json:"session_id"`
	Image        string `json:"image"`
	InitStateRef string `json:"init_state_ref,omitempty"`
	CPURequest   string `json:"cpu_request,omitempty"`
	MemRequest   string `json:"mem_request,omitempty"`
}

type InstanceStatus struct {
	SessionID string `json:"session_id"`
	Phase     Phase  `json:"phase"`
	Endpoint  string `json:"endpoint,omitempty"`
	Error     string `json:"error,omitempty"`
}

type CreateSessionRequest struct {
	SessionID    string `json:"session_id"`
	Image        string `json:"image,omitempty"`
	InitStateRef string `json:"init_state_ref,omitempty"`
}

type ListSessionsResponse struct {
	Instances    []InstanceStatus `json:"instances"`
	Total        int              `json:"total"`
	MaxInstances int              `json:"max_instances"`
}

var (
	ErrQuotaExceeded   = errors.New("quota exceeded: max instances reached")
	ErrAlreadyExists   = errors.New("session already exists")
	ErrSessionNotFound = errors.New("session not found")
	ErrInvalidSpec     = errors.New("invalid instance spec")
	ErrInstanceFailed  = errors.New("instance failed to start")
)

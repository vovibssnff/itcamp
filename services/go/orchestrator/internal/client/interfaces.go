package client

import (
	"context"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

type SimClient interface {
	CreateSession(ctx context.Context, sessionID string, initState []byte, seed int64) error
	DestroySession(ctx context.Context, sessionID string) error
	// Step advances the model by dtSec seconds of simulated time (≤0 → 1s).
	Step(ctx context.Context, sessionID string, dtSec float64) (domain.SimState, error)
	GetState(ctx context.Context, sessionID string) (domain.SimState, error)
	SetState(ctx context.Context, sessionID string, state domain.SimState) error
	InjectFault(ctx context.Context, req domain.InjectFaultReq) error
	SetSpeed(ctx context.Context, sessionID string, factor float64) error
	// SetActuator writes an operator setpoint/output to the process model (SET_SP).
	SetActuator(ctx context.Context, sessionID, tag string, value any) error
	// Command sends a typed Model API operator command (SET_SP, SET_OUT, SET_MODE, ACK_ALARM, ESD, …).
	Command(ctx context.Context, sessionID, cmdType, target string, value any) error
}

type AssessmentClient interface {
	SendEvent(ctx context.Context, sessionID, scenarioID, eventType string, data any) error
	GetScore(ctx context.Context, sessionID string) (any, error)
	Finalize(ctx context.Context, sessionID string) error
	CheckMissedSteps(ctx context.Context, sessionID string, modelTime float64) error
}

type SnapshotClient interface {
	Save(ctx context.Context, sessionID, name string, isPreset bool, state domain.SimState) (snapshotID, sha256 string, err error)
	Restore(ctx context.Context, snapshotID string) (domain.SimState, error)
}

type ConstructorClient interface {
	ExportTemplate(ctx context.Context, templateID string) ([]byte, error)
}

type ScenarioClient interface {
	GetFullScenario(ctx context.Context, scenarioID string) (jsonBytes []byte, err error)
	GetRandomExam(ctx context.Context, templateID string) (jsonBytes []byte, err error)
}

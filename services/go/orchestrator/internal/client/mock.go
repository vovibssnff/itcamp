package client

import (
	"context"

	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
)

type MockSimClient struct {
	Sessions map[string]bool
	States   map[string]domain.SimState
	Speeds   map[string]float64
	Faults   []domain.InjectFaultReq
}

func NewMockSimClient() *MockSimClient {
	return &MockSimClient{
		Sessions: make(map[string]bool),
		States:   make(map[string]domain.SimState),
		Speeds:   make(map[string]float64),
	}
}

func (m *MockSimClient) CreateSession(_ context.Context, sessionID string, _ []byte, _ int64) error {
	m.Sessions[sessionID] = true
	m.States[sessionID] = domain.SimState{SessionID: sessionID, ModelTime: 0}
	m.Speeds[sessionID] = 1.0
	return nil
}

func (m *MockSimClient) DestroySession(_ context.Context, sessionID string) error {
	delete(m.Sessions, sessionID)
	delete(m.States, sessionID)
	delete(m.Speeds, sessionID)
	return nil
}

func (m *MockSimClient) Step(_ context.Context, sessionID string, ticks int32) (domain.SimState, error) {
	s, ok := m.States[sessionID]
	if !ok {
		return domain.SimState{}, domain.ErrSimUnavailable
	}
	speed := m.Speeds[sessionID]
	s.ModelTime += float64(ticks) * speed
	// Produce evolving telemetry so WS/HMI smoke works without sim-worker.
	s.Tags = []domain.Tag{
		{TagID: "TIC-101.PV", Value: 180 + 0.1*s.ModelTime, Unit: "C", Quality: "good"},
		{TagID: "PIC-201.PV", Value: 1.2 + 0.01*s.ModelTime, Unit: "kgf/cm2", Quality: "good"},
		{TagID: "FIC-301.PV", Value: 50 + (s.ModelTime * 0.3), Unit: "m3/h", Quality: "good"},
	}
	s.Regulators = []domain.Regulator{
		{TagID: "FIC-301", PV: 50, SP: 55, OUT: 40, Mode: "AUTO"},
	}
	m.States[sessionID] = s
	return s, nil
}

func (m *MockSimClient) GetState(_ context.Context, sessionID string) (domain.SimState, error) {
	s, ok := m.States[sessionID]
	if !ok {
		return domain.SimState{}, domain.ErrSimUnavailable
	}
	return s, nil
}

func (m *MockSimClient) SetState(_ context.Context, sessionID string, state domain.SimState) error {
	m.States[sessionID] = state
	return nil
}

func (m *MockSimClient) InjectFault(_ context.Context, req domain.InjectFaultReq) error {
	m.Faults = append(m.Faults, req)
	return nil
}

func (m *MockSimClient) SetSpeed(_ context.Context, sessionID string, factor float64) error {
	m.Speeds[sessionID] = factor
	return nil
}

type MockAssessmentClient struct {
	Events    []string
	Scores    map[string]any
	Finalized []string
}

func NewMockAssessmentClient() *MockAssessmentClient {
	return &MockAssessmentClient{
		Scores: make(map[string]any),
	}
}

func (m *MockAssessmentClient) SendEvent(_ context.Context, sessionID, _scenarioID, eventType string, _ any) error {
	m.Events = append(m.Events, sessionID+":"+eventType)
	return nil
}

func (m *MockAssessmentClient) GetScore(_ context.Context, sessionID string) (any, error) {
	return m.Scores[sessionID], nil
}

func (m *MockAssessmentClient) Finalize(_ context.Context, sessionID string) error {
	m.Finalized = append(m.Finalized, sessionID)
	return nil
}

type MockSnapshotClient struct {
	Snapshots map[string]domain.SimState
	counter   int
}

func NewMockSnapshotClient() *MockSnapshotClient {
	return &MockSnapshotClient{
		Snapshots: make(map[string]domain.SimState),
	}
}

func (m *MockSnapshotClient) Save(_ context.Context, sessionID, name string, _ bool, state domain.SimState) (string, string, error) {
	m.counter++
	id := "snap-" + sessionID + "-" + name
	m.Snapshots[id] = state
	return id, "sha256-mock", nil
}

func (m *MockSnapshotClient) Restore(_ context.Context, snapshotID string) (domain.SimState, error) {
	s, ok := m.Snapshots[snapshotID]
	if !ok {
		return domain.SimState{}, domain.ErrSnapshotNotFound
	}
	return s, nil
}

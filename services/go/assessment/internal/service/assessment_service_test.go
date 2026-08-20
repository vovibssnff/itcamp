package service

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"testing"

	"github.com/itcamp/ktc/services/assessment/internal/domain"
)

var testLog = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))

type mockAssessmentStore struct {
	scores      map[string]domain.Score
	scenarioIDs map[string]string
	replay      map[string]domain.ReplayData
}

func newMockAssessmentStore() *mockAssessmentStore {
	return &mockAssessmentStore{
		scores:      make(map[string]domain.Score),
		scenarioIDs: make(map[string]string),
		replay:      make(map[string]domain.ReplayData),
	}
}

func (m *mockAssessmentStore) GetBySession(_ context.Context, sessionID string) (domain.Score, error) {
	s, ok := m.scores[sessionID]
	if !ok {
		return domain.Score{}, domain.ErrAssessmentNotFound
	}
	return s, nil
}

func (m *mockAssessmentStore) Upsert(_ context.Context, s domain.Score) error {
	m.scores[s.SessionID] = s
	return nil
}

func (m *mockAssessmentStore) SetVerdict(_ context.Context, sessionID string, verdict domain.Verdict, score int) error {
	if s, ok := m.scores[sessionID]; ok {
		s.Verdict = verdict
		s.TotalScore = score
		m.scores[sessionID] = s
	}
	return nil
}

func (m *mockAssessmentStore) SetOverride(_ context.Context, sessionID string, score int, verdict domain.Verdict, _, _ string) error {
	if s, ok := m.scores[sessionID]; ok {
		s.TotalScore = score
		s.Verdict = verdict
		m.scores[sessionID] = s
	}
	return nil
}

func (m *mockAssessmentStore) GetReplayData(_ context.Context, sessionID string) (domain.ReplayData, error) {
	if r, ok := m.replay[sessionID]; ok {
		return r, nil
	}
	return domain.ReplayData{}, nil
}

func (m *mockAssessmentStore) GetSessionScenarioID(_ context.Context, sessionID string) (string, error) {
	id, ok := m.scenarioIDs[sessionID]
	if !ok || id == "" {
		return "", domain.ErrSessionNotFound
	}
	return id, nil
}

type mockScenarioClient struct {
	data map[string]domain.ScenarioData
}

func newMockScenarioClient() *mockScenarioClient {
	return &mockScenarioClient{data: make(map[string]domain.ScenarioData)}
}

func (m *mockScenarioClient) GetScenario(_ context.Context, scenarioID string) (domain.ScenarioData, error) {
	d, ok := m.data[scenarioID]
	if !ok {
		return domain.ScenarioData{}, domain.ErrScenarioNotLoaded
	}
	return d, nil
}

func testAssessmentService() (*AssessmentService, *mockScenarioClient, *mockAssessmentStore) {
	client := newMockScenarioClient()
	store := newMockAssessmentStore()
	svc := NewAssessmentService(store, client, testLog)
	return svc, client, store
}

func testScenarioData() domain.ScenarioData {
	return domain.ScenarioData{
		ReferenceActions: []domain.ReferenceAction{
			{Step: 1, Description: "Decrease fuel", Expected: domain.ExpectedAction{Target: "TRC-3", Action: "decrease"}, DeadlineSeconds: 30, Mandatory: true},
			{Step: 2, Description: "Check pump", Expected: domain.ExpectedAction{Target: "PUMP-N1", Action: "check"}, DeadlineSeconds: 60, Mandatory: true},
		},
		Criteria: testCriteria(),
	}
}

func TestAssessmentService_ProcessEvent_Action(t *testing.T) {
	svc, client, _ := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "action", Target: "TRC-3", Action: "decrease", ModelTime: 110,
	}, "sc-1")
	if err != nil {
		t.Fatalf("process event failed: %v", err)
	}

	score, _ := svc.GetScore(context.Background(), "sess-1")
	if score.SessionID != "sess-1" {
		t.Error("expected score for sess-1")
	}
}

func TestAssessmentService_ProcessEvent_Alarm(t *testing.T) {
	svc, client, _ := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "alarm", TagID: "PRSA-204", Priority: "H", ModelTime: 100,
	}, "sc-1")
	if err != nil {
		t.Fatalf("process alarm failed: %v", err)
	}
}

func TestAssessmentService_ProcessEvent_CriticalAction(t *testing.T) {
	svc, client, _ := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "action", Action: "esd_without_reason", ModelTime: 200,
	}, "sc-1")
	if err != nil {
		t.Fatalf("process event failed: %v", err)
	}

	score, _ := svc.GetScore(context.Background(), "sess-1")
	if len(score.CriticalErrors) == 0 {
		t.Error("expected critical error recorded")
	}
}

func TestAssessmentService_Finalize(t *testing.T) {
	svc, client, _ := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	if err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "action", Target: "TRC-3", Action: "decrease", ModelTime: 110,
	}, "sc-1"); err != nil {
		t.Fatalf("process event failed: %v", err)
	}

	score, err := svc.Finalize(context.Background(), "sess-1")
	if err != nil {
		t.Fatalf("finalize failed: %v", err)
	}
	if score.Verdict != domain.VerdictPass && score.Verdict != domain.VerdictFail {
		t.Errorf("expected pass or fail, got %s", score.Verdict)
	}
}

func TestAssessmentService_Finalize_NotLoaded(t *testing.T) {
	svc, _, _ := testAssessmentService()
	_, err := svc.Finalize(context.Background(), "unknown-session")
	if err == nil {
		t.Fatal("expected error for unloaded session")
	}
}

func TestAssessmentService_AckAlarm(t *testing.T) {
	svc, client, _ := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	if err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "alarm", TagID: "PRSA-204", Priority: "H", ModelTime: 100,
	}, "sc-1"); err != nil {
		t.Fatalf("process event failed: %v", err)
	}

	svc.AckAlarm(context.Background(), "sess-1", "PRSA-204", 108.5)

	score, _ := svc.GetScore(context.Background(), "sess-1")
	if len(score.ReactionTimes) == 0 {
		t.Error("expected reaction time recorded")
	}
	if score.ReactionTimes[0].Seconds != 8.5 {
		t.Errorf("expected 8.5s, got %f", score.ReactionTimes[0].Seconds)
	}
}

func TestAssessmentService_CheckMissedSteps(t *testing.T) {
	svc, client, _ := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	if err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "action", Target: "TRC-3", Action: "decrease", ModelTime: 110,
	}, "sc-1"); err != nil {
		t.Fatalf("process event failed: %v", err)
	}

	svc.CheckMissedSteps(context.Background(), "sess-1", 200)

	score, _ := svc.GetScore(context.Background(), "sess-1")
	found := false
	for _, p := range score.Penalties {
		if p.Code == "MISSED_STEP" {
			found = true
		}
	}
	if !found {
		t.Error("expected missed step penalty for step 2")
	}
}

func TestAssessmentService_ProcessEvent_ColdLoadPreservesScore(t *testing.T) {
	svc, client, store := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	if err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "action", Action: "esd_without_reason", ModelTime: 50,
	}, "sc-1"); err != nil {
		t.Fatalf("process event failed: %v", err)
	}
	before, _ := svc.GetScore(context.Background(), "sess-1")
	if len(before.CriticalErrors) == 0 {
		t.Fatal("expected critical error before cold load")
	}

	// Simulate assessment process restart: in-memory map is empty, DB still has score.
	svc.mu.Lock()
	svc.sessions = make(map[string]*sessionState)
	svc.mu.Unlock()

	if err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "alarm", TagID: "PRSA-204", ModelTime: 60,
	}, "sc-1"); err != nil {
		t.Fatalf("cold-load process event failed: %v", err)
	}

	after, _ := svc.GetScore(context.Background(), "sess-1")
	if len(after.CriticalErrors) == 0 {
		t.Fatal("cold load wiped critical errors")
	}
	if after.CriticalErrors[0].Code != before.CriticalErrors[0].Code {
		t.Errorf("critical error changed after cold load: %#v", after.CriticalErrors)
	}
	persisted := store.scores["sess-1"]
	if len(persisted.CriticalErrors) == 0 {
		t.Fatal("DB upsert after cold load lost critical errors")
	}
}

func TestAssessmentService_ProcessEvent_ColdLoadKeepsCompletedSteps(t *testing.T) {
	svc, client, store := testAssessmentService()
	client.data["sc-1"] = testScenarioData()

	if err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "session_start", ModelTime: 0,
	}, "sc-1"); err != nil {
		t.Fatalf("session_start failed: %v", err)
	}
	if err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "action", Target: "TRC-3", Action: "decrease", ModelTime: 10,
	}, "sc-1"); err != nil {
		t.Fatalf("action failed: %v", err)
	}

	store.replay["sess-1"] = domain.ReplayData{
		Actions: []any{
			map[string]any{"type": "action", "target": "TRC-3", "action": "decrease", "model_time": 10.0},
		},
	}

	svc.mu.Lock()
	svc.sessions = make(map[string]*sessionState)
	svc.mu.Unlock()

	// Reload via a no-op alarm, then check missed at t=200: step 1 must not
	// become MISSED_STEP just because memory was lost.
	if err := svc.ProcessEvent(context.Background(), domain.AssessmentEvent{
		SessionID: "sess-1", Type: "alarm", TagID: "X", ModelTime: 200,
	}, "sc-1"); err != nil {
		t.Fatalf("cold-load failed: %v", err)
	}
	svc.CheckMissedSteps(context.Background(), "sess-1", 200)

	score, _ := svc.GetScore(context.Background(), "sess-1")
	for _, p := range score.Penalties {
		if p.Code == "MISSED_STEP" && strings.Contains(p.Description, "шаг 1") {
			t.Fatalf("step 1 incorrectly marked missed after cold load: %#v", p)
		}
	}
	foundStep2 := false
	for _, p := range score.Penalties {
		if p.Code == "MISSED_STEP" && strings.Contains(p.Description, "шаг 2") {
			foundStep2 = true
		}
	}
	if !foundStep2 {
		t.Fatal("expected MISSED_STEP for incomplete step 2 after cold load")
	}
}

func TestAssessmentService_Finalize_ColdLoadUsesScenarioThreshold(t *testing.T) {
	svc, client, store := testAssessmentService()
	client.data["sc-1"] = testScenarioData() // PassThreshold 70
	store.scenarioIDs["sess-1"] = "sc-1"
	store.scores["sess-1"] = domain.Score{
		SessionID:  "sess-1",
		TotalScore: 50,
		Verdict:    domain.VerdictPending,
	}

	score, err := svc.Finalize(context.Background(), "sess-1")
	if err != nil {
		t.Fatalf("finalize failed: %v", err)
	}
	if score.Verdict != domain.VerdictFail {
		t.Fatalf("expected fail with score 50 < threshold 70, got %s", score.Verdict)
	}
}

func TestParseStepNumber(t *testing.T) {
	step, ok := parseStepNumber("шаг 3 просрочен")
	if !ok || step != 3 {
		t.Fatalf("got %d %v", step, ok)
	}
	step, ok = parseStepNumber("обязательный шаг 12 пропущен")
	if !ok || step != 12 {
		t.Fatalf("got %d %v", step, ok)
	}
}
